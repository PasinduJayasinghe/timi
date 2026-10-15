//! Tray icon and its native menu (4d, as a standard Windows menu).
//!
//! The front end sends the timer state with `set_tray_state`; the menu's header counts the
//! running timer up once a second from its start time. Menu choices that change data go back
//! to the web view as `tray-action` events.

use std::sync::Mutex;
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, Wry};

/// Long titles are cut so the menu stays a sensible width.
const MAX_TITLE_CHARS: usize = 36;

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunningTimer {
    title: String,
    /// Session start, in milliseconds since the Unix epoch.
    started_at_ms: i64,
}

/// What the timer item does: "pause", "resume" or "start".
#[derive(Clone, Copy, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum TimerAction {
    Pause,
    Resume,
    Start,
}

impl TimerAction {
    fn label(self) -> &'static str {
        match self {
            TimerAction::Pause => "Pause timer",
            TimerAction::Resume => "Resume timer",
            TimerAction::Start => "Start task…",
        }
    }
}

#[derive(Clone, Serialize)]
struct TrayAction {
    action: TimerAction,
}

pub struct TrayState {
    header: MenuItem<Wry>,
    timer: MenuItem<Wry>,
    running: Mutex<Option<RunningTimer>>,
    action: Mutex<TimerAction>,
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

/// "24:13", or "1:02:05" past an hour, as on the task rows.
fn clock(ms: i64) -> String {
    let total = (ms / 1000).max(0);
    let (hours, minutes, seconds) = (total / 3600, total % 3600 / 60, total % 60);
    if hours > 0 {
        format!("{hours}:{minutes:02}:{seconds:02}")
    } else {
        format!("{minutes:02}:{seconds:02}")
    }
}

fn header_text(running: &Option<RunningTimer>) -> String {
    match running {
        Some(timer) => {
            let mut title: String = timer.title.chars().take(MAX_TITLE_CHARS).collect();
            if timer.title.chars().count() > MAX_TITLE_CHARS {
                title.push('…');
            }
            format!("{title} — {} running", clock(now_ms() - timer.started_at_ms))
        }
        None => "No timer running".to_string(),
    }
}

/// Updates the menu from the front end's timer state.
#[tauri::command]
pub fn set_tray_state(state: tauri::State<'_, TrayState>, running: Option<RunningTimer>, action: TimerAction) {
    let _ = state.header.set_text(header_text(&running));
    let _ = state.timer.set_text(action.label());
    *state.running.lock().unwrap_or_else(|p| p.into_inner()) = running;
    *state.action.lock().unwrap_or_else(|p| p.into_inner()) = action;
}

pub fn create(app: &AppHandle) -> tauri::Result<()> {
    let header = MenuItem::with_id(app, "header", "No timer running", false, None::<&str>)?;
    let show = MenuItem::with_id(app, "show", "Show Timi", true, None::<&str>)?;
    let timer = MenuItem::with_id(app, "timer", TimerAction::Start.label(), true, None::<&str>)?;
    let quick_add = MenuItem::with_id(app, "quick-add", "Quick add…", true, Some("Ctrl+Shift+Space"))?;
    let quit = MenuItem::with_id(app, "quit", "Quit Timi", true, None::<&str>)?;
    let menu = Menu::with_items(
        app,
        &[
            &header,
            &PredefinedMenuItem::separator(app)?,
            &show,
            &timer,
            &quick_add,
            &PredefinedMenuItem::separator(app)?,
            &quit,
        ],
    )?;

    let mut builder = TrayIconBuilder::with_id("main")
        .tooltip("Timi")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show" => crate::show_main_window(app),
            "timer" => {
                let action = *app.state::<TrayState>().action.lock().unwrap_or_else(|p| p.into_inner());
                // Starting a task needs the window for the Start task sheet
                if action == TimerAction::Start {
                    crate::show_main_window(app);
                }
                let _ = app.emit("tray-action", TrayAction { action });
            }
            "quick-add" => crate::open_quick_add(app),
            "quit" => crate::request_quit(app),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                crate::show_main_window(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    builder.build(app)?;

    app.manage(TrayState {
        header: header.clone(),
        timer,
        running: Mutex::new(None),
        action: Mutex::new(TimerAction::Start),
    });

    // Count the running timer up in the header
    let app = app.clone();
    thread::spawn(move || loop {
        thread::sleep(Duration::from_secs(1));
        let state = app.state::<TrayState>();
        let running = state.running.lock().unwrap_or_else(|p| p.into_inner()).clone();
        if running.is_some() {
            let _ = state.header.set_text(header_text(&running));
        }
    });

    Ok(())
}
