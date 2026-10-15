//! The calendar cache: account, calendars and events, kept in `calendar.json` in the app data
//! folder so events stay visible offline (3c) and the 5b alarm scheduler can read them.

use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CalendarInfo {
    pub id: String,
    pub name: String,
    /// Calendar colour from Google, e.g. "#F27FA5".
    pub color: String,
    pub primary: bool,
    /// Shown in Timi ("Calendars to include", 4e).
    pub included: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Attendee {
    pub name: String,
    pub is_self: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CalendarEvent {
    pub id: String,
    pub calendar_id: String,
    pub title: String,
    /// Milliseconds since the Unix epoch.
    pub start_ms: i64,
    pub end_ms: i64,
    /// Only Google Meet links, so Join can open them safely.
    pub meet_url: Option<String>,
    pub location: Option<String>,
    pub attendees: Vec<Attendee>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CalendarCache {
    /// Signed-in account email.
    pub account: Option<String>,
    pub calendars: Vec<CalendarInfo>,
    pub events: Vec<CalendarEvent>,
    pub synced_at_ms: Option<i64>,
    /// The time range the events were synced for, [start, end) in ms.
    pub window: Option<(i64, i64)>,
}

fn cache_path(app: &AppHandle) -> Option<PathBuf> {
    app.path().app_data_dir().ok().map(|dir| dir.join("calendar.json"))
}

pub fn load(app: &AppHandle) -> CalendarCache {
    cache_path(app)
        .and_then(|path| fs::read_to_string(path).ok())
        .and_then(|text| serde_json::from_str(&text).ok())
        .unwrap_or_default()
}

pub fn save(app: &AppHandle, cache: &CalendarCache) {
    let Some(path) = cache_path(app) else { return };
    if let Some(dir) = path.parent() {
        let _ = fs::create_dir_all(dir);
    }
    match serde_json::to_string(cache) {
        Ok(text) => {
            if let Err(error) = fs::write(&path, text) {
                eprintln!("[calendar] cache save failed: {error}");
            }
        }
        Err(error) => eprintln!("[calendar] cache encode failed: {error}"),
    }
}

pub fn clear(app: &AppHandle) {
    if let Some(path) = cache_path(app) {
        let _ = fs::remove_file(path);
    }
}
