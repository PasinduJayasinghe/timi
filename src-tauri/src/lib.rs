mod calendar;
mod cloud;
mod meetings;
mod reminders;
mod tray;

use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;
use std::time::Duration;

use tauri::{AppHandle, Emitter, Manager, WindowEvent};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};
use tauri_plugin_sql::{Migration, MigrationKind};
use tauri_plugin_window_state::{AppHandleExt, StateFlags};

/// Database URL used by the front end (`Database.load`). The file lives in the app config folder.
const DB_URL: &str = "sqlite:timi.db";

/// Global quick add (4e, 4d).
const QUICK_ADD_SHORTCUT: &str = "CommandOrControl+Shift+Space";

/// How long Quit waits for the web view to save a running timer before exiting anyway.
const QUIT_TIMEOUT: Duration = Duration::from_secs(3);

fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "tasks, sessions, clients and projects",
            sql: include_str!("../migrations/0001_init.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "session heartbeat",
            sql: include_str!("../migrations/0002_session_heartbeat.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "task reminders and settings",
            sql: include_str!("../migrations/0003_reminders_settings.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "meeting timers linked to calendar events",
            sql: include_str!("../migrations/0004_calendar_meetings.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "session sync",
            sql: include_str!("../migrations/0005_session_sync.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 6,
            description: "shifts",
            sql: include_str!("../migrations/0006_shifts.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 7,
            description: "day goals and notes",
            sql: include_str!("../migrations/0007_day_plans.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 8,
            description: "planned task times",
            sql: include_str!("../migrations/0008_planned_times.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 9,
            description: "quick notes",
            sql: include_str!("../migrations/0009_notes.sql"),
            kind: MigrationKind::Up,
        },
    ]
}

/// Whether Ctrl+Shift+Space was registered; another app may already own it.
#[derive(Default)]
struct ShortcutStatus(AtomicBool);

/// Brings the main window back from the tray (or from behind other windows).
pub fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// Shows Timi on Today with the quick add field focused.
pub fn open_quick_add(app: &AppHandle) {
    show_main_window(app);
    let _ = app.emit("quick-add", ());
}

/// Asks the web view to save a running timer, then quits. Quits anyway if it doesn't answer.
pub fn request_quit(app: &AppHandle) {
    let _ = app.emit("quit-requested", ());
    let app = app.clone();
    thread::spawn(move || {
        thread::sleep(QUIT_TIMEOUT);
        quit(&app);
    });
}

fn quit(app: &AppHandle) {
    let _ = app.save_window_state(StateFlags::POSITION);
    app.exit(0);
}

/// Called by the web view once a running timer is saved.
#[tauri::command]
fn quit_app(app: AppHandle) {
    quit(&app);
}

#[tauri::command]
fn quick_add_shortcut_registered(status: tauri::State<'_, ShortcutStatus>) -> bool {
    status.0.load(Ordering::Relaxed)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Registered first, so a second launch is caught before anything else starts
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_main_window(app);
        }))
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(DB_URL, migrations())
                .build(),
        )
        // Position only: the window size follows the window mode (expanded, wide or mini bar)
        .plugin(
            tauri_plugin_window_state::Builder::new()
                .with_state_flags(StateFlags::POSITION)
                .build(),
        )
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        // Rust only: opens the Google sign-in page and Meet links (no web view permission)
        .plugin(tauri_plugin_opener::init())
        .manage(reminders::Reminders::default())
        .manage(ShortcutStatus::default())
        .manage(meetings::Meetings::default())
        .manage(cloud::Cloud::default())
        .invoke_handler(tauri::generate_handler![
            quit_app,
            quick_add_shortcut_registered,
            reminders::set_reminders,
            tray::set_tray_state,
            calendar::calendar_status,
            calendar::calendar_connect,
            calendar::calendar_disconnect,
            calendar::calendar_sync,
            calendar::calendar_events,
            calendar::calendar_set_included,
            calendar::open_meet,
            meetings::set_meeting_prefs,
            meetings::meeting_alarm_info,
            meetings::alarm_join,
            meetings::alarm_start_timer,
            meetings::alarm_snooze,
            meetings::alarm_dismiss,
            meetings::alarm_set_prefs,
            cloud::cloud_status,
            cloud::cloud_upload,
        ])
        .setup(|app| {
            let handle = app.handle();
            tray::create(handle)?;
            reminders::start(handle.clone());
            app.manage(calendar::Calendar::new(handle));
            calendar::start(handle.clone());
            meetings::start(handle.clone());

            let registered = app
                .global_shortcut()
                .on_shortcut(QUICK_ADD_SHORTCUT, |app, _shortcut, event| {
                    if event.state == ShortcutState::Pressed {
                        open_quick_add(app);
                    }
                });
            match registered {
                Ok(()) => app.state::<ShortcutStatus>().0.store(true, Ordering::Relaxed),
                Err(error) => eprintln!("[shortcut] {QUICK_ADD_SHORTCUT} unavailable: {error}"),
            }
            Ok(())
        })
        // Closing the main window (including Alt+F4) hides Timi to the tray; Quit is in the tray
        // menu. Other windows, such as the meeting alarm, close normally.
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
