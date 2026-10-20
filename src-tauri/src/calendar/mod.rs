//! Google Calendar, read-only (Phase 5a): sign-in, token storage, sync and the event cache.
//!
//! Tokens never reach the web view: the refresh token lives in Windows Credential Manager and
//! the access token in memory. The web view reads status and events through the commands below
//! and hears `calendar-changed` after each sync.

pub mod google;
mod oauth;
pub mod store;

use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use chrono::Utc;
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_opener::OpenerExt;
use tokio::sync::Mutex;

use google::ApiError;
use oauth::OAuthError;
use store::{CalendarCache, CalendarEvent, CalendarInfo};

const KEYRING_SERVICE: &str = "com.pasindu.timi.google-calendar";
const KEYRING_USER: &str = "refresh-token";
const DAY_MS: i64 = 24 * 60 * 60 * 1000;
/// Events are synced from two weeks back to five weeks ahead; other ranges load on demand.
const SYNC_BACK_MS: i64 = 14 * DAY_MS;
const SYNC_AHEAD_MS: i64 = 35 * DAY_MS;
const SYNC_EVERY: Duration = Duration::from_secs(5 * 60);
/// Focus can ask for a sync often; skip it if one ran this recently.
const MIN_SYNC_GAP_MS: i64 = 60_000;

/// Why a Google ID token isn't available.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum IdTokenError {
    /// Google Calendar isn't connected.
    SignedOut,
    Network,
    /// The grant was revoked, or Google sent no ID token.
    Revoked,
}

/// Why the last sync failed (3c): offline or Google unreachable, or the grant was revoked.
#[derive(Debug, Clone, Copy, Serialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum SyncProblem {
    Network,
    Auth,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CalendarStatus {
    /// False when this build has no OAuth client (no `.env`).
    configured: bool,
    connected: bool,
    email: Option<String>,
    synced_at_ms: Option<i64>,
    problem: Option<SyncProblem>,
    calendars: Vec<CalendarInfo>,
    syncing: bool,
}

struct Inner {
    cache: CalendarCache,
    /// Access token and its expiry (ms).
    access: Option<(String, i64)>,
    /// Google ID token and its expiry (ms), exchanged for a Supabase session by `cloud`.
    id_token: Option<(String, i64)>,
    problem: Option<SyncProblem>,
}

pub struct Calendar {
    client: reqwest::Client,
    inner: Mutex<Inner>,
    syncing: AtomicBool,
}

fn now_ms() -> i64 {
    Utc::now().timestamp_millis()
}

fn keyring_entry() -> Option<keyring::Entry> {
    keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER).ok()
}

fn stored_refresh_token() -> Option<String> {
    keyring_entry()?.get_password().ok()
}

fn emit_changed(app: &AppHandle) {
    let _ = app.emit("calendar-changed", ());
}

impl Calendar {
    pub fn new(app: &AppHandle) -> Self {
        let mut cache = store::load(app);
        // Without a stored grant the cached account is stale (e.g. removed in Credential Manager)
        if cache.account.is_some() && stored_refresh_token().is_none() {
            cache = CalendarCache::default();
            store::clear(app);
        }
        Calendar {
            client: reqwest::Client::builder()
                .timeout(Duration::from_secs(30))
                .build()
                .unwrap_or_default(),
            inner: Mutex::new(Inner { cache, access: None, id_token: None, problem: None }),
            syncing: AtomicBool::new(false),
        }
    }

    async fn store_id_token(&self, id_token: &str) {
        let expires = oauth::id_token_expiry_ms(id_token).unwrap_or_else(|| now_ms() + 30 * 60_000);
        self.inner.lock().await.id_token = Some((id_token.to_string(), expires));
    }

    /// A Google ID token for the signed-in account, refreshed when it has (nearly) expired.
    /// Used by `cloud` to sign in to Supabase with the same Google account.
    pub async fn google_id_token(&self) -> Result<String, IdTokenError> {
        {
            let inner = self.inner.lock().await;
            if inner.cache.account.is_none() {
                return Err(IdTokenError::SignedOut);
            }
            if let Some((token, expires)) = &inner.id_token
                && *expires > now_ms() + 60_000
            {
                return Ok(token.clone());
            }
        }
        self.access_token(true).await.map_err(|problem| match problem {
            SyncProblem::Auth => IdTokenError::Revoked,
            SyncProblem::Network => IdTokenError::Network,
        })?;
        self.inner.lock().await.id_token.as_ref().map(|(token, _)| token.clone()).ok_or(IdTokenError::Revoked)
    }

    /// Cached events of included calendars overlapping [start, end), for the meeting alarms.
    pub async fn events_between(&self, start_ms: i64, end_ms: i64) -> Vec<CalendarEvent> {
        let inner = self.inner.lock().await;
        visible_events(&inner.cache, start_ms, end_ms)
    }

    /// The same, from a plain thread (the tray ticker). Never call this from async code.
    pub fn events_between_blocking(&self, start_ms: i64, end_ms: i64) -> Vec<CalendarEvent> {
        let inner = self.inner.blocking_lock();
        visible_events(&inner.cache, start_ms, end_ms)
    }

    async fn status(&self) -> CalendarStatus {
        let inner = self.inner.lock().await;
        CalendarStatus {
            configured: oauth::client_config().is_some(),
            connected: inner.cache.account.is_some(),
            email: inner.cache.account.clone(),
            synced_at_ms: inner.cache.synced_at_ms,
            problem: inner.problem,
            calendars: inner.cache.calendars.clone(),
            syncing: self.syncing.load(Ordering::Relaxed),
        }
    }

    /// A valid access token, refreshing it when it has (nearly) expired.
    async fn access_token(&self, force_refresh: bool) -> Result<String, SyncProblem> {
        if !force_refresh
            && let Some((token, expires)) = &self.inner.lock().await.access
            && *expires > now_ms() + 60_000
        {
            return Ok(token.clone());
        }
        let config = oauth::client_config().ok_or(SyncProblem::Auth)?;
        let refresh_token = stored_refresh_token().ok_or(SyncProblem::Auth)?;
        match oauth::refresh(&self.client, &config, &refresh_token).await {
            Ok(tokens) => {
                let expires = now_ms() + tokens.expires_in * 1000;
                if let Some(id_token) = &tokens.id_token {
                    self.store_id_token(id_token).await;
                }
                self.inner.lock().await.access = Some((tokens.access_token.clone(), expires));
                Ok(tokens.access_token)
            }
            Err(OAuthError::Revoked) => Err(SyncProblem::Auth),
            Err(_) => Err(SyncProblem::Network),
        }
    }

    /// Runs `call` with an access token, refreshing once if Google rejects it.
    async fn with_token<T, F, Fut>(&self, call: F) -> Result<T, SyncProblem>
    where
        F: Fn(String) -> Fut,
        Fut: std::future::Future<Output = Result<T, ApiError>>,
    {
        let token = self.access_token(false).await?;
        match call(token).await {
            Ok(value) => Ok(value),
            Err(ApiError::Unauthorized) => {
                let token = self.access_token(true).await?;
                call(token).await.map_err(|error| match error {
                    ApiError::Unauthorized => SyncProblem::Auth,
                    ApiError::Network(_) => SyncProblem::Network,
                })
            }
            Err(ApiError::Network(_)) => Err(SyncProblem::Network),
        }
    }

    async fn fetch_events(&self, calendars: &[CalendarInfo], start: i64, end: i64) -> Result<Vec<CalendarEvent>, SyncProblem> {
        let mut events = Vec::new();
        for calendar in calendars.iter().filter(|c| c.included) {
            let found = self
                .with_token(|token| {
                    let client = self.client.clone();
                    let id = calendar.id.clone();
                    async move { google::events(&client, &token, &id, start, end).await }
                })
                .await?;
            events.extend(found);
        }
        events.sort_by_key(|event| event.start_ms);
        Ok(events)
    }

    async fn sync_inner(&self) -> Result<(), SyncProblem> {
        let fetched = self
            .with_token(|token| {
                let client = self.client.clone();
                async move { google::calendar_list(&client, &token).await }
            })
            .await?;
        // Keep the user's include choices; new calendars start included only if primary
        let previous = self.inner.lock().await.cache.calendars.clone();
        let calendars: Vec<CalendarInfo> = fetched
            .into_iter()
            .map(|mut calendar| {
                if let Some(old) = previous.iter().find(|c| c.id == calendar.id) {
                    calendar.included = old.included;
                }
                calendar
            })
            .collect();
        let now = now_ms();
        let window = (now - SYNC_BACK_MS, now + SYNC_AHEAD_MS);
        let events = self.fetch_events(&calendars, window.0, window.1).await?;

        let mut inner = self.inner.lock().await;
        inner.cache.calendars = calendars;
        inner.cache.events = events;
        inner.cache.window = Some(window);
        inner.cache.synced_at_ms = Some(now);
        Ok(())
    }

    /// Syncs if connected. Skips when another sync is running, or one ran within a minute
    /// (unless `force`).
    pub async fn sync(&self, app: &AppHandle, force: bool) {
        {
            let inner = self.inner.lock().await;
            if inner.cache.account.is_none() {
                return;
            }
            let recent = inner.cache.synced_at_ms.is_some_and(|at| now_ms() - at < MIN_SYNC_GAP_MS);
            if recent && !force && inner.problem.is_none() {
                return;
            }
        }
        if self.syncing.swap(true, Ordering::AcqRel) {
            return;
        }
        emit_changed(app);
        let result = self.sync_inner().await;
        {
            let mut inner = self.inner.lock().await;
            inner.problem = result.err();
            if let Some(problem) = inner.problem {
                eprintln!("[calendar] sync failed: {problem:?}");
            } else {
                store::save(app, &inner.cache);
            }
        }
        self.syncing.store(false, Ordering::Release);
        emit_changed(app);
    }
}

fn visible_events(cache: &CalendarCache, start_ms: i64, end_ms: i64) -> Vec<CalendarEvent> {
    if cache.account.is_none() {
        return Vec::new();
    }
    let included: Vec<&str> = cache.calendars.iter().filter(|c| c.included).map(|c| c.id.as_str()).collect();
    cache
        .events
        .iter()
        .filter(|e| e.end_ms > start_ms && e.start_ms < end_ms && included.contains(&e.calendar_id.as_str()))
        .cloned()
        .collect()
}

/// Starts the background sync: now, then every five minutes.
pub fn start(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        loop {
            app.state::<Calendar>().sync(&app, true).await;
            tokio::time::sleep(SYNC_EVERY).await;
        }
    });
}

#[tauri::command]
pub async fn calendar_status(state: tauri::State<'_, Calendar>) -> Result<CalendarStatus, String> {
    Ok(state.status().await)
}

/// Signs in with Google in the browser, then syncs. Errors: "not-configured", "cancelled", "network".
#[tauri::command]
pub async fn calendar_connect(app: AppHandle, state: tauri::State<'_, Calendar>) -> Result<CalendarStatus, String> {
    let config = oauth::client_config().ok_or("not-configured")?;
    let opener = app.clone();
    let tokens = oauth::sign_in(&state.client, &config, move |url| {
        opener.opener().open_url(url, None::<&str>).map_err(|e| e.to_string())
    })
    .await
    .map_err(|error| {
        eprintln!("[calendar] sign-in failed: {error:?}");
        match error {
            OAuthError::Network(_) => "network",
            _ => "cancelled",
        }
    })?;
    let refresh_token = tokens.refresh_token.as_deref().ok_or("cancelled")?;
    keyring_entry()
        .ok_or("cancelled")?
        .set_password(refresh_token)
        .map_err(|error| {
            eprintln!("[calendar] storing the token failed: {error}");
            "cancelled"
        })?;
    let email = tokens
        .id_token
        .as_deref()
        .and_then(oauth::email_from_id_token)
        .unwrap_or_else(|| "Google account".into());
    {
        let mut inner = state.inner.lock().await;
        inner.cache = CalendarCache { account: Some(email), ..CalendarCache::default() };
        inner.access = Some((tokens.access_token, now_ms() + tokens.expires_in * 1000));
        inner.id_token = tokens.id_token.as_deref().map(|token| {
            let expires = oauth::id_token_expiry_ms(token).unwrap_or_else(|| now_ms() + 30 * 60_000);
            (token.to_string(), expires)
        });
        inner.problem = None;
        store::save(&app, &inner.cache);
    }
    emit_changed(&app);
    state.sync(&app, true).await;
    Ok(state.status().await)
}

/// Revokes access, deletes the stored token and clears the cache.
#[tauri::command]
pub async fn calendar_disconnect(app: AppHandle, state: tauri::State<'_, Calendar>) -> Result<CalendarStatus, String> {
    if let Some(token) = stored_refresh_token() {
        oauth::revoke(&state.client, &token).await;
    }
    if let Some(entry) = keyring_entry() {
        let _ = entry.delete_credential();
    }
    {
        let mut inner = state.inner.lock().await;
        inner.cache = CalendarCache::default();
        inner.access = None;
        inner.id_token = None;
        inner.problem = None;
    }
    store::clear(&app);
    emit_changed(&app);
    Ok(state.status().await)
}

/// Syncs now (Retry, or the window gaining focus).
#[tauri::command]
pub async fn calendar_sync(app: AppHandle, state: tauri::State<'_, Calendar>, force: bool) -> Result<(), String> {
    state.sync(&app, force).await;
    Ok(())
}

/// Events of included calendars overlapping [start, end). Ranges outside the synced window are
/// fetched from Google and added to the cache.
#[tauri::command]
pub async fn calendar_events(
    app: AppHandle,
    state: tauri::State<'_, Calendar>,
    start_ms: i64,
    end_ms: i64,
) -> Result<Vec<CalendarEvent>, String> {
    let (connected, covered, calendars) = {
        let inner = state.inner.lock().await;
        let covered = inner.cache.window.is_some_and(|(from, to)| from <= start_ms && end_ms <= to);
        (inner.cache.account.is_some(), covered, inner.cache.calendars.clone())
    };
    if connected
        && !covered
        && let Ok(fetched) = state.fetch_events(&calendars, start_ms, end_ms).await
    {
        let mut inner = state.inner.lock().await;
        // Replace what the cache had for this range with what Google has now
        inner.cache.events.retain(|e| !(e.end_ms > start_ms && e.start_ms < end_ms));
        inner.cache.events.extend(fetched);
        inner.cache.events.sort_by(|a, b| a.start_ms.cmp(&b.start_ms).then_with(|| a.id.cmp(&b.id)));
        inner.cache.events.dedup_by(|a, b| a.id == b.id);
        store::save(&app, &inner.cache);
    }
    Ok(state.events_between(start_ms, end_ms).await)
}

/// "Calendars to include" (4e).
#[tauri::command]
pub async fn calendar_set_included(
    app: AppHandle,
    state: tauri::State<'_, Calendar>,
    ids: Vec<String>,
) -> Result<CalendarStatus, String> {
    {
        let mut inner = state.inner.lock().await;
        for calendar in inner.cache.calendars.iter_mut() {
            calendar.included = ids.contains(&calendar.id);
        }
        store::save(&app, &inner.cache);
    }
    emit_changed(&app);
    state.sync(&app, true).await;
    Ok(state.status().await)
}

/// Opens a Google Meet link in the browser. Anything else is refused.
#[tauri::command]
pub fn open_meet(app: AppHandle, url: String) -> Result<(), String> {
    if !google::is_meet_url(&url) {
        return Err("not a Google Meet link".into());
    }
    app.opener().open_url(url, None::<&str>).map_err(|e| e.to_string())
}
