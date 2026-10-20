//! Google Calendar API v3: the calendar list and events, read-only.

use chrono::{DateTime, Utc};
use reqwest::{Client, StatusCode, Url};
use serde::Deserialize;

use super::store::{Attendee, CalendarEvent, CalendarInfo};

const API: &str = "https://www.googleapis.com/calendar/v3";
/// Default colour when Google doesn't send one: the design's calendar rose.
const DEFAULT_COLOR: &str = "#F27FA5";

#[derive(Debug)]
#[allow(dead_code)] // details are read through Debug when logged
pub enum ApiError {
    /// The access token was rejected: refresh it and try again.
    Unauthorized,
    Network(String),
}

impl From<reqwest::Error> for ApiError {
    fn from(error: reqwest::Error) -> Self {
        ApiError::Network(error.to_string())
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CalendarListResponse {
    #[serde(default)]
    items: Vec<CalendarListItem>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CalendarListItem {
    id: String,
    summary: Option<String>,
    summary_override: Option<String>,
    background_color: Option<String>,
    #[serde(default)]
    primary: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EventsResponse {
    #[serde(default)]
    items: Vec<EventItem>,
    next_page_token: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct EventItem {
    id: String,
    status: Option<String>,
    summary: Option<String>,
    start: Option<EventTime>,
    end: Option<EventTime>,
    hangout_link: Option<String>,
    conference_data: Option<ConferenceData>,
    location: Option<String>,
    #[serde(default)]
    attendees: Vec<EventAttendee>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct EventTime {
    /// Timed events; all-day events have `date` instead.
    date_time: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ConferenceData {
    #[serde(default)]
    entry_points: Vec<EntryPoint>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct EntryPoint {
    entry_point_type: Option<String>,
    uri: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct EventAttendee {
    email: Option<String>,
    display_name: Option<String>,
    #[serde(rename = "self", default)]
    is_self: bool,
    response_status: Option<String>,
}

fn parse_time(time: &Option<EventTime>) -> Option<i64> {
    let text = time.as_ref()?.date_time.as_ref()?;
    DateTime::parse_from_rfc3339(text).ok().map(|t| t.timestamp_millis())
}

/// Only Google Meet links are kept, so Join never opens anything else.
/// Only plain https links to meet.google.com are opened (no other host, login part or port).
pub fn is_meet_url(url: &str) -> bool {
    match Url::parse(url) {
        Ok(parsed) => {
            parsed.scheme() == "https"
                && parsed.host_str() == Some("meet.google.com")
                && parsed.port().is_none()
                && parsed.username().is_empty()
                && parsed.password().is_none()
        }
        Err(_) => false,
    }
}

fn meet_url(item: &EventItem) -> Option<String> {
    let from_conference = item.conference_data.as_ref().and_then(|data| {
        data.entry_points
            .iter()
            .find(|entry| entry.entry_point_type.as_deref() == Some("video"))
            .and_then(|entry| entry.uri.clone())
    });
    item.hangout_link.clone().or(from_conference).filter(|url| is_meet_url(url))
}

/// Events worth showing: timed (not all-day), not cancelled, not declined.
pub fn parse_events(response: &EventsResponse, calendar_id: &str) -> Vec<CalendarEvent> {
    response
        .items
        .iter()
        .filter(|item| item.status.as_deref() != Some("cancelled"))
        .filter(|item| {
            !item
                .attendees
                .iter()
                .any(|a| a.is_self && a.response_status.as_deref() == Some("declined"))
        })
        .filter_map(|item| {
            let start_ms = parse_time(&item.start)?;
            let end_ms = parse_time(&item.end)?;
            Some(CalendarEvent {
                id: format!("{calendar_id}:{}", item.id),
                calendar_id: calendar_id.to_string(),
                title: item.summary.clone().filter(|s| !s.trim().is_empty()).unwrap_or_else(|| "(No title)".into()),
                start_ms,
                end_ms: end_ms.max(start_ms),
                meet_url: meet_url(item),
                location: item.location.clone().filter(|s| !s.trim().is_empty()),
                attendees: item
                    .attendees
                    .iter()
                    .filter(|a| a.response_status.as_deref() != Some("declined"))
                    .map(|a| Attendee {
                        name: a
                            .display_name
                            .clone()
                            .or_else(|| a.email.as_ref().map(|e| e.split('@').next().unwrap_or(e).to_string()))
                            .unwrap_or_default(),
                        is_self: a.is_self,
                    })
                    .collect(),
            })
        })
        .collect()
}

async fn get<T: for<'de> Deserialize<'de>>(client: &Client, token: &str, url: Url) -> Result<T, ApiError> {
    let response = client.get(url).bearer_auth(token).send().await?;
    if response.status() == StatusCode::UNAUTHORIZED {
        return Err(ApiError::Unauthorized);
    }
    Ok(response.error_for_status()?.json::<T>().await?)
}

pub async fn calendar_list(client: &Client, token: &str) -> Result<Vec<CalendarInfo>, ApiError> {
    let url = Url::parse_with_params(&format!("{API}/users/me/calendarList"), &[("minAccessRole", "reader")])
        .map_err(|e| ApiError::Network(e.to_string()))?;
    let list: CalendarListResponse = get(client, token, url).await?;
    Ok(list
        .items
        .into_iter()
        .map(|item| CalendarInfo {
            name: item.summary_override.or(item.summary).unwrap_or_else(|| item.id.clone()),
            color: item.background_color.unwrap_or_else(|| DEFAULT_COLOR.into()),
            primary: item.primary,
            included: item.primary,
            id: item.id,
        })
        .collect())
}

/// All timed events of one calendar in [start, end), following pages.
pub async fn events(
    client: &Client,
    token: &str,
    calendar_id: &str,
    start_ms: i64,
    end_ms: i64,
) -> Result<Vec<CalendarEvent>, ApiError> {
    let rfc3339 = |ms: i64| {
        DateTime::<Utc>::from_timestamp_millis(ms)
            .map(|t| t.to_rfc3339())
            .unwrap_or_default()
    };
    let mut all = Vec::new();
    let mut page: Option<String> = None;
    loop {
        let mut url = Url::parse(API).map_err(|e| ApiError::Network(e.to_string()))?;
        url.path_segments_mut()
            .map_err(|_| ApiError::Network("bad API URL".into()))?
            .extend(["calendars", calendar_id, "events"]);
        {
            let mut query = url.query_pairs_mut();
            query
                .append_pair("timeMin", &rfc3339(start_ms))
                .append_pair("timeMax", &rfc3339(end_ms))
                .append_pair("singleEvents", "true")
                .append_pair("orderBy", "startTime")
                .append_pair("maxResults", "250");
            if let Some(token) = &page {
                query.append_pair("pageToken", token);
            }
        }
        let response: EventsResponse = get(client, token, url).await?;
        all.extend(parse_events(&response, calendar_id));
        match response.next_page_token {
            Some(next) => page = Some(next),
            None => return Ok(all),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keeps_timed_events_with_meet_links() {
        let json = r#"{
          "items": [
            {"id": "a", "summary": "Sprint planning · Client A",
             "start": {"dateTime": "2026-10-11T00:30:00+05:30"}, "end": {"dateTime": "2026-10-11T01:15:00+05:30"},
             "hangoutLink": "https://meet.google.com/abc-defg-hij",
             "attendees": [{"email": "ak@example.com", "displayName": "Asha K"}, {"email": "me@example.com", "self": true}]},
            {"id": "b", "summary": "Client B weekly sync",
             "start": {"dateTime": "2026-10-11T03:00:00Z"}, "end": {"dateTime": "2026-10-11T03:30:00Z"},
             "location": "Phone",
             "conferenceData": {"entryPoints": [{"entryPointType": "video", "uri": "https://zoom.example.com/j/1"}]}},
            {"id": "c", "summary": "Holiday", "start": {"date": "2026-10-12"}, "end": {"date": "2026-10-13"}},
            {"id": "d", "status": "cancelled", "summary": "Gone",
             "start": {"dateTime": "2026-10-11T04:00:00Z"}, "end": {"dateTime": "2026-10-11T05:00:00Z"}},
            {"id": "e", "summary": "Declined",
             "start": {"dateTime": "2026-10-11T04:00:00Z"}, "end": {"dateTime": "2026-10-11T05:00:00Z"},
             "attendees": [{"email": "me@example.com", "self": true, "responseStatus": "declined"}]}
          ]
        }"#;
        let response: EventsResponse = serde_json::from_str(json).unwrap();
        let events = parse_events(&response, "primary");
        assert_eq!(events.len(), 2);

        let planning = &events[0];
        assert_eq!(planning.id, "primary:a");
        assert_eq!(planning.start_ms, DateTime::parse_from_rfc3339("2026-10-10T19:00:00Z").unwrap().timestamp_millis());
        assert_eq!(planning.end_ms - planning.start_ms, 45 * 60 * 1000);
        assert_eq!(planning.meet_url.as_deref(), Some("https://meet.google.com/abc-defg-hij"));
        assert_eq!(planning.attendees.len(), 2);
        assert_eq!(planning.attendees[0].name, "Asha K");
        assert_eq!(planning.attendees[1].name, "me");
        assert!(planning.attendees[1].is_self);

        // Non-Meet video links are dropped; the location stays
        assert_eq!(events[1].meet_url, None);
        assert_eq!(events[1].location.as_deref(), Some("Phone"));
    }

    #[test]
    fn untitled_events_get_a_placeholder() {
        let json = r#"{"items": [{"id": "x", "start": {"dateTime": "2026-10-11T03:00:00Z"}, "end": {"dateTime": "2026-10-11T03:30:00Z"}}]}"#;
        let response: EventsResponse = serde_json::from_str(json).unwrap();
        assert_eq!(parse_events(&response, "c")[0].title, "(No title)");
    }

    #[test]
    fn only_meet_links_count() {
        assert!(is_meet_url("https://meet.google.com/abc-defg-hij"));
        assert!(!is_meet_url("http://meet.google.com/abc"));
        assert!(!is_meet_url("https://meet.google.com.evil.example/abc"));
        assert!(!is_meet_url("javascript:alert(1)"));
        assert!(!is_meet_url("https://meet.google.com@evil.example/abc"));
        assert!(!is_meet_url("https://meet.google.com:8443/abc"));
        assert!(!is_meet_url("https://user@meet.google.com/abc"));
    }
}
