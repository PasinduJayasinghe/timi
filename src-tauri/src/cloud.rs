//! Offline-first upload of sessions to the company Supabase project (Phase 6a).
//!
//! Upload only: the web view owns the database, finds sessions waiting to upload and passes them
//! here. Rust signs in to Supabase with the Google ID token from the Calendar connection
//! (`grant_type=id_token`), so tokens never reach the web view, then upserts the rows.

use std::time::Duration;

use chrono::Utc;
use reqwest::{Client, StatusCode};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use tokio::sync::Mutex;

use crate::calendar::{Calendar, IdTokenError};

/// Rows per request.
const BATCH: usize = 100;
const TABLE: &str = "timi_sessions";

/// The Supabase project, compiled in from the gitignored `.env` (see build.rs).
struct CloudConfig {
    url: &'static str,
    anon_key: &'static str,
}

fn config() -> Option<CloudConfig> {
    match (option_env!("TIMI_SUPABASE_URL"), option_env!("TIMI_SUPABASE_ANON_KEY")) {
        (Some(url), Some(anon_key)) if !url.is_empty() && !anon_key.is_empty() => {
            Some(CloudConfig { url: url.trim_end_matches('/'), anon_key })
        }
        _ => None,
    }
}

/// Why an upload didn't happen; sent to the web view as a plain string.
#[derive(Debug, Clone, Copy, PartialEq)]
enum CloudError {
    NotConfigured,
    /// Google Calendar isn't connected, so there's no account to sign in with.
    SignedOut,
    Network,
    /// Supabase didn't accept the sign-in.
    Auth,
    /// Supabase refused the rows (logged).
    Rejected,
}

impl CloudError {
    fn as_str(self) -> &'static str {
        match self {
            CloudError::NotConfigured => "not-configured",
            CloudError::SignedOut => "signed-out",
            CloudError::Network => "network",
            CloudError::Auth => "auth",
            CloudError::Rejected => "rejected",
        }
    }
}

impl From<reqwest::Error> for CloudError {
    fn from(_: reqwest::Error) -> Self {
        CloudError::Network
    }
}

/// One closed session with its task details copied in. Read in camelCase from the web view,
/// written in snake_case to match the Supabase table (docs/supabase/timi_sessions.sql).
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all(deserialize = "camelCase", serialize = "snake_case"))]
pub struct SessionUpload {
    id: String,
    task_id: String,
    task_title: String,
    task_type: String,
    client_name: Option<String>,
    project_name: Option<String>,
    ticket_number: Option<String>,
    calendar_event_id: Option<String>,
    /// Work day, "YYYY-MM-DD" (starts at 6 am).
    work_day: String,
    /// UTC ISO timestamps.
    started_at: String,
    ended_at: String,
}

#[derive(Deserialize)]
struct SupabaseSession {
    access_token: String,
    expires_in: i64,
}

#[derive(Default)]
pub struct Cloud {
    client: Client,
    /// Supabase access token and its expiry (ms).
    session: Mutex<Option<(String, i64)>>,
}

fn now_ms() -> i64 {
    Utc::now().timestamp_millis()
}

fn token_url(config: &CloudConfig) -> String {
    format!("{}/auth/v1/token?grant_type=id_token", config.url)
}

fn upload_url(config: &CloudConfig) -> String {
    format!("{}/rest/v1/{TABLE}?on_conflict=id", config.url)
}

impl Cloud {
    /// A Supabase access token, signing in again with a fresh Google ID token when needed.
    async fn session_token(&self, app: &AppHandle, config: &CloudConfig, force: bool) -> Result<String, CloudError> {
        if !force
            && let Some((token, expires)) = &*self.session.lock().await
            && *expires > now_ms() + 60_000
        {
            return Ok(token.clone());
        }
        let id_token = app.state::<Calendar>().google_id_token().await.map_err(|error| match error {
            IdTokenError::SignedOut => CloudError::SignedOut,
            IdTokenError::Network => CloudError::Network,
            IdTokenError::Revoked => CloudError::Auth,
        })?;
        let response = self
            .client
            .post(token_url(config))
            .header("apikey", config.anon_key)
            .json(&serde_json::json!({ "provider": "google", "id_token": id_token }))
            .timeout(Duration::from_secs(30))
            .send()
            .await?;
        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            eprintln!("[cloud] sign-in refused ({status}): {body}");
            return Err(if status.is_server_error() { CloudError::Network } else { CloudError::Auth });
        }
        let session: SupabaseSession = response.json().await?;
        let token = session.access_token;
        *self.session.lock().await = Some((token.clone(), now_ms() + session.expires_in * 1000));
        Ok(token)
    }

    async fn post_rows(&self, config: &CloudConfig, token: &str, rows: &[SessionUpload]) -> Result<StatusCode, CloudError> {
        let response = self
            .client
            .post(upload_url(config))
            .header("apikey", config.anon_key)
            .bearer_auth(token)
            .header("Prefer", "resolution=merge-duplicates,return=minimal")
            .json(rows)
            .timeout(Duration::from_secs(30))
            .send()
            .await?;
        let status = response.status();
        if !status.is_success() && status != StatusCode::UNAUTHORIZED {
            let body = response.text().await.unwrap_or_default();
            eprintln!("[cloud] upload refused ({status}): {body}");
        }
        Ok(status)
    }

    async fn upload(&self, app: &AppHandle, rows: &[SessionUpload]) -> Result<Vec<String>, CloudError> {
        let config = config().ok_or(CloudError::NotConfigured)?;
        let mut uploaded = Vec::new();
        for chunk in rows.chunks(BATCH) {
            let mut token = self.session_token(app, &config, false).await?;
            let mut status = self.post_rows(&config, &token, chunk).await?;
            if status == StatusCode::UNAUTHORIZED {
                token = self.session_token(app, &config, true).await?;
                status = self.post_rows(&config, &token, chunk).await?;
            }
            if status.is_server_error() {
                return Err(CloudError::Network);
            }
            if status == StatusCode::UNAUTHORIZED {
                return Err(CloudError::Auth);
            }
            if !status.is_success() {
                return Err(CloudError::Rejected);
            }
            uploaded.extend(chunk.iter().map(|row| row.id.clone()));
        }
        Ok(uploaded)
    }
}

#[derive(Serialize)]
pub struct CloudStatus {
    configured: bool,
}

/// Whether this build has a Supabase project (`.env`). Without one, Timi stays local only.
#[tauri::command]
pub fn cloud_status() -> CloudStatus {
    CloudStatus { configured: config().is_some() }
}

/// Upserts sessions and returns the ids uploaded. Errors: "not-configured", "signed-out",
/// "network", "auth", "rejected".
#[tauri::command]
pub async fn cloud_upload(
    app: AppHandle,
    state: tauri::State<'_, Cloud>,
    rows: Vec<SessionUpload>,
) -> Result<Vec<String>, String> {
    if rows.is_empty() {
        return Ok(Vec::new());
    }
    state.upload(&app, &rows).await.map_err(|error| error.as_str().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn config() -> CloudConfig {
        CloudConfig { url: "https://project.supabase.example", anon_key: "anon" }
    }

    #[test]
    fn signs_in_and_upserts_at_the_right_urls() {
        assert_eq!(token_url(&config()), "https://project.supabase.example/auth/v1/token?grant_type=id_token");
        assert_eq!(
            upload_url(&config()),
            "https://project.supabase.example/rest/v1/timi_sessions?on_conflict=id"
        );
    }

    #[test]
    fn reads_camel_case_and_writes_snake_case() {
        let row: SessionUpload = serde_json::from_str(
            r#"{"id":"s1","taskId":"t1","taskTitle":"Checkout flow","taskType":"client","clientName":"Client A",
                "projectName":"Storefront","ticketNumber":null,"calendarEventId":null,"workDay":"2026-10-10",
                "startedAt":"2026-10-10T19:00:00.000Z","endedAt":"2026-10-10T20:15:00.000Z"}"#,
        )
        .unwrap();
        let json = serde_json::to_value(&row).unwrap();
        assert_eq!(json["task_title"], "Checkout flow");
        assert_eq!(json["client_name"], "Client A");
        assert_eq!(json["work_day"], "2026-10-10");
        assert_eq!(json["ticket_number"], serde_json::Value::Null);
        assert!(json.get("taskTitle").is_none());
    }

    #[test]
    fn error_names_match_the_web_view() {
        let names: Vec<&str> = [
            CloudError::NotConfigured,
            CloudError::SignedOut,
            CloudError::Network,
            CloudError::Auth,
            CloudError::Rejected,
        ]
        .iter()
        .map(|error| error.as_str())
        .collect();
        assert_eq!(names, ["not-configured", "signed-out", "network", "auth", "rejected"]);
    }
}
