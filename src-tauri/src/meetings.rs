//! Meeting alarms (4a, 4b), scheduled in Rust so they fire while Timi is hidden in the tray.
//!
//! A 10-second tick reads the calendar cache. When a meeting is due, the alarm window opens
//! (label `alarm`, `index.html#alarm`). The alarm window acts through the commands below; the
//! main window starts and stops meeting timers from the `meeting-start-timer` and
//! `meeting-ended` events, because it owns the database.

use std::collections::{HashMap, HashSet};
use std::sync::Mutex;
use std::time::Duration;

use chrono::Utc;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_opener::OpenerExt;

use crate::calendar::store::CalendarEvent;
use crate::calendar::Calendar;

const TICK: Duration = Duration::from_secs(10);
const MINUTE_MS: i64 = 60_000;
/// A meeting still alarms this long after it starts (e.g. Timi was just opened).
const LATE_GRACE_MS: i64 = MINUTE_MS;
/// "Snooze 2 min" (4a).
const SNOOZE_MS: i64 = 2 * MINUTE_MS;
pub const ALARM_LABEL: &str = "alarm";
/// Must match `additionalBrowserArgs` of the main window in tauri.conf.json: windows share one
/// WebView2 environment, which needs the same arguments. Lets the alarm chime play by itself.
const BROWSER_ARGS: &str =
    "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection --autoplay-policy=no-user-gesture-required";

/// Settings > Meetings (4e) and the 4b checkbox. The main window owns them (SQLite) and sends
/// them with `set_meeting_prefs`; changes made in the alarm window come back as `meeting-prefs-changed`.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MeetingPrefs {
    pub lead_minutes: i64,
    pub chime: bool,
    pub auto_start: bool,
}

impl Default for MeetingPrefs {
    fn default() -> Self {
        MeetingPrefs { lead_minutes: 5, chime: true, auto_start: false }
    }
}

#[derive(Default)]
struct State {
    prefs: MeetingPrefs,
    /// Events already alarmed (once each).
    fired: HashSet<String>,
    /// Events the user dismissed.
    dismissed: HashSet<String>,
    /// Snoozed events and when to alarm again (ms).
    snoozed: HashMap<String, i64>,
    /// The event shown in the alarm window.
    current: Option<CalendarEvent>,
    /// Events with a running meeting timer, and when they end (ms).
    tracked: HashMap<String, i64>,
}

#[derive(Default)]
pub struct Meetings {
    state: Mutex<State>,
}

impl Meetings {
    fn lock(&self) -> std::sync::MutexGuard<'_, State> {
        self.state.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
    }
}

fn now_ms() -> i64 {
    Utc::now().timestamp_millis()
}

/// The meeting to alarm about now, if any (earliest first).
fn due_alarm<'a>(
    events: &'a [CalendarEvent],
    prefs: &MeetingPrefs,
    fired: &HashSet<String>,
    dismissed: &HashSet<String>,
    snoozed: &HashMap<String, i64>,
    now: i64,
) -> Option<&'a CalendarEvent> {
    let lead = prefs.lead_minutes * MINUTE_MS;
    events
        .iter()
        .filter(|event| !dismissed.contains(&event.id))
        .filter(|event| match snoozed.get(&event.id) {
            // A snoozed meeting comes back until it ends
            Some(until) => now >= *until && now < event.end_ms,
            None => !fired.contains(&event.id) && event.start_ms - lead <= now && now < event.start_ms + LATE_GRACE_MS,
        })
        .min_by_key(|event| event.start_ms)
}

/// Opens (or refreshes) the alarm window: centred, on top, focused (4a).
fn show_alarm_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(ALARM_LABEL) {
        let _ = window.show();
        let _ = window.set_focus();
        let _ = app.emit_to(ALARM_LABEL, "alarm-changed", ());
        return;
    }
    let built = WebviewWindowBuilder::new(app, ALARM_LABEL, WebviewUrl::App("index.html#alarm".into()))
        .title("Meeting soon")
        .inner_size(360.0, 340.0)
        .resizable(false)
        .maximizable(false)
        .minimizable(false)
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .always_on_top(true)
        .center()
        .focused(true)
        .additional_browser_args(BROWSER_ARGS)
        .build();
    if let Err(error) = built {
        eprintln!("[meetings] alarm window failed: {error}");
    }
}

fn close_alarm_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(ALARM_LABEL) {
        let _ = window.close();
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct MeetingRef {
    event_id: String,
    title: String,
    end_ms: i64,
}

/// Starts the scheduler. Call once from setup, after `Meetings` and `Calendar` are managed.
pub fn start(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        loop {
            tick(&app).await;
            tokio::time::sleep(TICK).await;
        }
    });
}

async fn tick(app: &AppHandle) {
    let now = now_ms();
    let events = app
        .state::<Calendar>()
        .events_between(now - 24 * 60 * MINUTE_MS, now + 24 * 60 * MINUTE_MS)
        .await;
    let meetings = app.state::<Meetings>();
    let (due, ended) = {
        let mut state = meetings.lock();
        let ended: Vec<String> = state.tracked.iter().filter(|(_, end)| now >= **end).map(|(id, _)| id.clone()).collect();
        for id in &ended {
            state.tracked.remove(id);
        }
        // Forget events that are gone from the cache
        let known: HashSet<&str> = events.iter().map(|e| e.id.as_str()).collect();
        state.fired.retain(|id| known.contains(id.as_str()));
        state.dismissed.retain(|id| known.contains(id.as_str()));
        state.snoozed.retain(|id, _| known.contains(id.as_str()));

        let due = due_alarm(&events, &state.prefs, &state.fired, &state.dismissed, &state.snoozed, now).cloned();
        if let Some(event) = &due {
            state.snoozed.remove(&event.id);
            state.fired.insert(event.id.clone());
            state.current = Some(event.clone());
        }
        (due, ended)
    };
    for id in ended {
        let _ = app.emit("meeting-ended", id);
    }
    if due.is_some() {
        show_alarm_window(app);
    }
}

/// The next meeting still to start within the next 12 hours, for the tray (4d).
pub fn next_meeting(app: &AppHandle) -> Option<CalendarEvent> {
    let now = now_ms();
    // The tray can ask before setup has registered the calendar
    let calendar = app.try_state::<Calendar>()?;
    let events = calendar.events_between_blocking(now, now + 12 * 60 * MINUTE_MS);
    events.into_iter().filter(|event| event.start_ms > now).min_by_key(|event| event.start_ms)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AlarmInfo {
    event: CalendarEvent,
    prefs: MeetingPrefs,
    /// The running task, which a meeting timer would pause (4b).
    running_title: Option<String>,
}

#[tauri::command]
pub fn set_meeting_prefs(state: tauri::State<'_, Meetings>, prefs: MeetingPrefs) {
    state.lock().prefs = prefs;
}

#[tauri::command]
pub fn meeting_alarm_info(app: AppHandle, state: tauri::State<'_, Meetings>) -> Option<AlarmInfo> {
    let guard = state.lock();
    let event = guard.current.clone()?;
    Some(AlarmInfo { event, prefs: guard.prefs, running_title: crate::tray::running_title(&app) })
}

fn start_timer_for(app: &AppHandle, state: &Meetings, event: &CalendarEvent) {
    state.lock().tracked.insert(event.id.clone(), event.end_ms);
    let _ = app.emit(
        "meeting-start-timer",
        MeetingRef { event_id: event.id.clone(), title: event.title.clone(), end_ms: event.end_ms },
    );
}

/// Join Google Meet (4a). Returns true when the timer started by itself ("Always start
/// automatically when I join"), so the window can close instead of offering 4b.
#[tauri::command]
pub fn alarm_join(app: AppHandle, state: tauri::State<'_, Meetings>) -> Result<bool, String> {
    let (event, auto_start) = {
        let guard = state.lock();
        (guard.current.clone().ok_or("no alarm")?, guard.prefs.auto_start)
    };
    let url = event.meet_url.clone().ok_or("no Meet link")?;
    if !crate::calendar::google::is_meet_url(&url) {
        return Err("not a Google Meet link".into());
    }
    app.opener().open_url(url, None::<&str>).map_err(|e| e.to_string())?;
    if auto_start {
        start_timer_for(&app, &state, &event);
        close_alarm_window(&app);
    }
    Ok(auto_start)
}

/// "Start meeting timer" (4b).
#[tauri::command]
pub fn alarm_start_timer(app: AppHandle, state: tauri::State<'_, Meetings>) {
    let event = state.lock().current.clone();
    if let Some(event) = event {
        start_timer_for(&app, &state, &event);
    }
    close_alarm_window(&app);
}

/// "Snooze 2 min" (4a).
#[tauri::command]
pub fn alarm_snooze(app: AppHandle, state: tauri::State<'_, Meetings>) {
    {
        let mut guard = state.lock();
        if let Some(event) = guard.current.take() {
            guard.snoozed.insert(event.id, now_ms() + SNOOZE_MS);
        }
    }
    close_alarm_window(&app);
}

/// "Dismiss" (4a), and "Not now" (4b).
#[tauri::command]
pub fn alarm_dismiss(app: AppHandle, state: tauri::State<'_, Meetings>) {
    {
        let mut guard = state.lock();
        if let Some(event) = guard.current.take() {
            guard.dismissed.insert(event.id);
        }
    }
    close_alarm_window(&app);
}

/// Lead time, chime or auto-start changed in the alarm window: tell the main window to save it.
#[tauri::command]
pub fn alarm_set_prefs(app: AppHandle, state: tauri::State<'_, Meetings>, prefs: MeetingPrefs) {
    state.lock().prefs = prefs;
    let _ = app.emit("meeting-prefs-changed", prefs);
}

#[cfg(test)]
mod tests {
    use super::*;

    fn event(id: &str, start_min: i64, end_min: i64) -> CalendarEvent {
        CalendarEvent {
            id: id.into(),
            calendar_id: "primary".into(),
            title: id.into(),
            start_ms: start_min * MINUTE_MS,
            end_ms: end_min * MINUTE_MS,
            meet_url: None,
            location: None,
            attendees: vec![],
        }
    }

    fn due(events: &[CalendarEvent], state: &State, now_min: i64) -> Option<String> {
        due_alarm(events, &state.prefs, &state.fired, &state.dismissed, &state.snoozed, now_min * MINUTE_MS)
            .map(|e| e.id.clone())
    }

    #[test]
    fn alarms_within_the_lead_time() {
        let events = [event("a", 100, 145)];
        let state = State::default();
        assert_eq!(due(&events, &state, 94), None);
        assert_eq!(due(&events, &state, 95).as_deref(), Some("a"));
        assert_eq!(due(&events, &state, 100).as_deref(), Some("a"));
        // More than a minute after the start, a missed alarm is skipped
        assert_eq!(due(&events, &state, 102), None);
    }

    #[test]
    fn follows_the_lead_setting() {
        let events = [event("a", 100, 145)];
        let state = State { prefs: MeetingPrefs { lead_minutes: 15, ..MeetingPrefs::default() }, ..State::default() };
        assert_eq!(due(&events, &state, 85).as_deref(), Some("a"));
    }

    #[test]
    fn alarms_once_and_respects_dismiss() {
        let events = [event("a", 100, 145)];
        let mut state = State::default();
        state.fired.insert("a".into());
        assert_eq!(due(&events, &state, 97), None);
        state.fired.clear();
        state.dismissed.insert("a".into());
        assert_eq!(due(&events, &state, 97), None);
    }

    #[test]
    fn snooze_comes_back_until_the_meeting_ends() {
        let events = [event("a", 100, 145)];
        let mut state = State::default();
        state.fired.insert("a".into());
        state.snoozed.insert("a".into(), 102 * MINUTE_MS);
        assert_eq!(due(&events, &state, 101), None);
        assert_eq!(due(&events, &state, 102).as_deref(), Some("a"));
        assert_eq!(due(&events, &state, 144).as_deref(), Some("a"));
        assert_eq!(due(&events, &state, 145), None);
    }

    #[test]
    fn picks_the_earliest_due_meeting() {
        let events = [event("later", 104, 130), event("first", 102, 130)];
        assert_eq!(due(&events, &State::default(), 100).as_deref(), Some("first"));
    }
}
