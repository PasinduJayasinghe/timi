//! Task reminders, scheduled in Rust so they fire while the window is hidden in the tray.
//!
//! The front end sends the whole schedule with `set_reminders` whenever today's tasks change.
//! A background thread waits for the next one and shows a Windows toast (4c) with
//! "Start timer" and "Snooze 10 min"; the chosen action goes back to the web view as
//! a `reminder-action` event, because the web view owns the database writes.

use std::collections::HashSet;
use std::sync::{Arc, Condvar, Mutex};
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

/// The scheduler wakes at least this often, so sleep and clock changes can't delay a reminder for long.
const MAX_WAIT_MS: i64 = 30_000;
/// Fired reminders are remembered for a day, so a re-sent schedule can't fire one twice.
const FIRED_MEMORY_MS: i64 = 24 * 60 * 60 * 1000;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Reminder {
    task_id: String,
    /// Toast title: the task title.
    title: String,
    /// Toast text, e.g. "Reminder · 11:55 pm · Client B".
    body: String,
    /// When to fire, in milliseconds since the Unix epoch.
    at_ms: i64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ReminderAction {
    task_id: String,
    /// "start" or "snooze".
    action: String,
}

#[derive(Default)]
struct Schedule {
    pending: Vec<Reminder>,
    fired: HashSet<(String, i64)>,
}

#[derive(Default)]
pub struct Reminders {
    inner: Arc<(Mutex<Schedule>, Condvar)>,
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

/// Replaces the schedule with the reminders the front end sends.
#[tauri::command]
pub fn set_reminders(state: tauri::State<'_, Reminders>, reminders: Vec<Reminder>) {
    let (lock, wake) = &*state.inner;
    let mut schedule = lock.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    let pending: Vec<Reminder> = reminders
        .into_iter()
        .filter(|r| !schedule.fired.contains(&(r.task_id.clone(), r.at_ms)))
        .collect();
    schedule.pending = pending;
    wake.notify_all();
}

/// Starts the scheduler thread. Call once from setup, after `Reminders` is managed.
pub fn start(app: AppHandle) {
    let inner = app.state::<Reminders>().inner.clone();
    thread::spawn(move || loop {
        let due = {
            let (lock, wake) = &*inner;
            let mut schedule = lock.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
            let now = now_ms();
            let (due, rest): (Vec<Reminder>, Vec<Reminder>) =
                schedule.pending.drain(..).partition(|r| r.at_ms <= now);
            schedule.pending = rest;
            schedule.fired.retain(|(_, at)| *at > now - FIRED_MEMORY_MS);
            for reminder in &due {
                schedule.fired.insert((reminder.task_id.clone(), reminder.at_ms));
            }
            if due.is_empty() {
                let next = schedule.pending.iter().map(|r| r.at_ms).min();
                let wait = next.map_or(MAX_WAIT_MS, |at| (at - now).clamp(0, MAX_WAIT_MS));
                let _ = wake
                    .wait_timeout(schedule, Duration::from_millis(wait as u64))
                    .unwrap_or_else(|poisoned| poisoned.into_inner());
                continue;
            }
            due
        };
        for reminder in due {
            show(&app, reminder);
        }
    });
}

#[cfg(windows)]
fn show(app: &AppHandle, reminder: Reminder) {
    use tauri::Emitter;
    use tauri_winrt_notification::{Scenario, Toast};

    // Windows only shows toasts for a registered app ID. The installer registers the bundle
    // identifier; development builds borrow PowerShell's, so toasts there say "Windows PowerShell".
    let app_id = if cfg!(debug_assertions) {
        Toast::POWERSHELL_APP_ID.to_string()
    } else {
        app.config().identifier.clone()
    };
    let handle = app.clone();
    let task_id = reminder.task_id.clone();
    let result = Toast::new(&app_id)
        .title(&reminder.title)
        .text1(&reminder.body)
        // Stays on screen until the user acts on it
        .scenario(Scenario::Reminder)
        .add_button("Start timer", "start")
        .add_button("Snooze 10 min", "snooze")
        .on_activated(move |action| {
            match action.as_deref() {
                Some(action @ ("start" | "snooze")) => {
                    let _ = handle.emit(
                        "reminder-action",
                        ReminderAction {
                            task_id: task_id.clone(),
                            action: action.to_string(),
                        },
                    );
                }
                // A click on the toast itself opens Timi
                _ => crate::show_main_window(&handle),
            }
            Ok(())
        })
        .show();
    if let Err(error) = result {
        eprintln!("[reminders] toast failed: {error}");
    }
}

#[cfg(not(windows))]
fn show(_app: &AppHandle, reminder: Reminder) {
    eprintln!("[reminders] toasts are Windows-only: {}", reminder.title);
}
