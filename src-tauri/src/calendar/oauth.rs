//! Google sign-in for installed apps: authorization code with PKCE, received on a loopback port.
//! See https://developers.google.com/identity/protocols/oauth2/native-app

use std::time::Duration;

use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use rand::distributions::Alphanumeric;
use rand::Rng;
use reqwest::{Client, Url};
use serde::Deserialize;
use sha2::{Digest, Sha256};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

const AUTH_URL: &str = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL: &str = "https://oauth2.googleapis.com/token";
const REVOKE_URL: &str = "https://oauth2.googleapis.com/revoke";
/// Read-only calendar access, plus the account email to show who is signed in.
const SCOPES: &str = "openid email https://www.googleapis.com/auth/calendar.readonly";
/// How long the browser sign-in may take.
const SIGN_IN_TIMEOUT: Duration = Duration::from_secs(5 * 60);
/// A connection to the loopback port that sends nothing for this long is dropped, so it can't
/// hold up the real redirect.
const READ_TIMEOUT: Duration = Duration::from_secs(5);

/// The page shown in the browser tab after sign-in.
const DONE_PAGE: &str = "<!doctype html><meta charset=utf-8><title>Timi</title>\
<body style=\"font-family:system-ui,sans-serif;color:#1e1b4b;background:#f1edff;display:grid;place-items:center;height:100vh;margin:0\">\
<p>You can close this tab and return to Timi.</p>";
const FAILED_PAGE: &str = "<!doctype html><meta charset=utf-8><title>Timi</title>\
<body style=\"font-family:system-ui,sans-serif;color:#1e1b4b;background:#f1edff;display:grid;place-items:center;height:100vh;margin:0\">\
<p>Sign-in didn’t finish. Return to Timi to try again.</p>";

/// The OAuth client, compiled in from the gitignored `.env` (see build.rs).
pub struct ClientConfig {
    pub id: &'static str,
    pub secret: &'static str,
}

pub fn client_config() -> Option<ClientConfig> {
    match (option_env!("TIMI_GOOGLE_CLIENT_ID"), option_env!("TIMI_GOOGLE_CLIENT_SECRET")) {
        (Some(id), Some(secret)) if !id.is_empty() && !secret.is_empty() => Some(ClientConfig { id, secret }),
        _ => None,
    }
}

#[derive(Debug)]
#[allow(dead_code)] // details are read through Debug when logged
pub enum OAuthError {
    /// The user closed the tab, denied access, or took too long.
    Cancelled(String),
    /// The stored grant no longer works; the user must connect again.
    Revoked,
    Network(String),
}

impl From<reqwest::Error> for OAuthError {
    fn from(error: reqwest::Error) -> Self {
        OAuthError::Network(error.to_string())
    }
}

#[derive(Deserialize)]
pub struct TokenResponse {
    pub access_token: String,
    pub expires_in: i64,
    pub refresh_token: Option<String>,
    pub id_token: Option<String>,
}

#[derive(Deserialize)]
struct TokenError {
    error: String,
}

fn random_string(length: usize) -> String {
    rand::thread_rng().sample_iter(&Alphanumeric).take(length).map(char::from).collect()
}

/// PKCE S256 challenge for a verifier (RFC 7636).
pub fn pkce_challenge(verifier: &str) -> String {
    URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()))
}

pub fn auth_url(client_id: &str, redirect_uri: &str, challenge: &str, state: &str) -> String {
    Url::parse_with_params(
        AUTH_URL,
        &[
            ("client_id", client_id),
            ("redirect_uri", redirect_uri),
            ("response_type", "code"),
            ("scope", SCOPES),
            ("code_challenge", challenge),
            ("code_challenge_method", "S256"),
            ("state", state),
            // A refresh token every time, so reconnecting always works
            ("access_type", "offline"),
            ("prompt", "consent"),
        ],
    )
    .map(String::from)
    .unwrap_or_default()
}

fn id_token_claims(id_token: &str) -> Option<serde_json::Value> {
    let payload = id_token.split('.').nth(1)?;
    let bytes = URL_SAFE_NO_PAD.decode(payload.trim_end_matches('=')).ok()?;
    serde_json::from_slice(&bytes).ok()
}

/// The email in an ID token straight from Google's token endpoint (no signature check needed).
pub fn email_from_id_token(id_token: &str) -> Option<String> {
    id_token_claims(id_token)?.get("email")?.as_str().map(str::to_string)
}

/// When an ID token expires, in milliseconds since the Unix epoch (its `exp` claim).
pub fn id_token_expiry_ms(id_token: &str) -> Option<i64> {
    id_token_claims(id_token)?.get("exp")?.as_i64().map(|seconds| seconds * 1000)
}

/// Query parameters from the redirect's request line, e.g. "GET /?code=…&state=… HTTP/1.1".
fn redirect_params(request: &str) -> Option<Vec<(String, String)>> {
    let target = request.lines().next()?.split_whitespace().nth(1)?;
    let url = Url::parse(&format!("http://127.0.0.1{target}")).ok()?;
    if url.path() != "/" {
        return None;
    }
    Some(url.query_pairs().map(|(k, v)| (k.into_owned(), v.into_owned())).collect())
}

/// Opens the browser to sign in and waits for Google to redirect back with a code.
pub async fn sign_in(
    client: &Client,
    config: &ClientConfig,
    open_browser: impl FnOnce(String) -> Result<(), String>,
) -> Result<TokenResponse, OAuthError> {
    let listener = TcpListener::bind("127.0.0.1:0")
        .await
        .map_err(|e| OAuthError::Network(e.to_string()))?;
    let port = listener.local_addr().map_err(|e| OAuthError::Network(e.to_string()))?.port();
    let redirect_uri = format!("http://127.0.0.1:{port}");
    let verifier = random_string(64);
    let state = random_string(32);
    open_browser(auth_url(config.id, &redirect_uri, &pkce_challenge(&verifier), &state))
        .map_err(OAuthError::Cancelled)?;

    let code = tokio::time::timeout(SIGN_IN_TIMEOUT, async {
        loop {
            let (mut stream, _) = listener.accept().await.map_err(|e| OAuthError::Network(e.to_string()))?;
            let mut buffer = vec![0u8; 8192];
            let read = tokio::time::timeout(READ_TIMEOUT, stream.read(&mut buffer))
                .await
                .ok()
                .and_then(Result::ok)
                .unwrap_or(0);
            let request = String::from_utf8_lossy(&buffer[..read]);
            // Ignore anything that isn't the redirect, such as a favicon request
            let Some(params) = redirect_params(&request) else {
                let _ = stream.write_all(b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n").await;
                continue;
            };
            let get = |key: &str| params.iter().find(|(k, _)| k == key).map(|(_, v)| v.clone());
            // Only Google's redirect carries our state; anything else (another program poking
            // the port) is refused without ending the sign-in
            if get("state").as_deref() != Some(state.as_str()) {
                let _ = stream.write_all(b"HTTP/1.1 400 Bad Request\r\nContent-Length: 0\r\n\r\n").await;
                continue;
            }
            let result = match (get("code"), get("error")) {
                (Some(code), _) => Ok(code),
                (None, Some(error)) => Err(OAuthError::Cancelled(error)),
                (None, None) => Err(OAuthError::Cancelled("no code".into())),
            };
            let page = if result.is_ok() { DONE_PAGE } else { FAILED_PAGE };
            let response = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{page}",
                page.len()
            );
            let _ = stream.write_all(response.as_bytes()).await;
            return result;
        }
    })
    .await
    .map_err(|_| OAuthError::Cancelled("timed out".into()))??;

    let response = client
        .post(TOKEN_URL)
        .form(&[
            ("code", code.as_str()),
            ("client_id", config.id),
            ("client_secret", config.secret),
            ("redirect_uri", redirect_uri.as_str()),
            ("grant_type", "authorization_code"),
            ("code_verifier", verifier.as_str()),
        ])
        .send()
        .await?;
    if !response.status().is_success() {
        let error = response.json::<TokenError>().await.map(|e| e.error).unwrap_or_default();
        return Err(OAuthError::Cancelled(error));
    }
    Ok(response.json::<TokenResponse>().await?)
}

/// A new access token from the stored refresh token.
pub async fn refresh(client: &Client, config: &ClientConfig, refresh_token: &str) -> Result<TokenResponse, OAuthError> {
    let response = client
        .post(TOKEN_URL)
        .form(&[
            ("client_id", config.id),
            ("client_secret", config.secret),
            ("refresh_token", refresh_token),
            ("grant_type", "refresh_token"),
        ])
        .send()
        .await?;
    if response.status().is_success() {
        return Ok(response.json::<TokenResponse>().await?);
    }
    let error = response.json::<TokenError>().await.map(|e| e.error).unwrap_or_default();
    if error == "invalid_grant" {
        Err(OAuthError::Revoked)
    } else {
        Err(OAuthError::Network(error))
    }
}

/// Best effort: revoking can fail offline, and the local credential is deleted either way.
pub async fn revoke(client: &Client, token: &str) {
    let _ = client.post(REVOKE_URL).form(&[("token", token)]).send().await;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pkce_matches_rfc_7636() {
        assert_eq!(
            pkce_challenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
            "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
        );
    }

    #[test]
    fn auth_url_asks_for_read_only_calendar_access() {
        let url = Url::parse(&auth_url("client-1", "http://127.0.0.1:5000", "challenge", "state-1")).unwrap();
        let get = |key: &str| url.query_pairs().find(|(k, _)| k == key).map(|(_, v)| v.into_owned());
        assert_eq!(url.host_str(), Some("accounts.google.com"));
        assert_eq!(get("redirect_uri").as_deref(), Some("http://127.0.0.1:5000"));
        assert_eq!(get("code_challenge_method").as_deref(), Some("S256"));
        assert_eq!(get("state").as_deref(), Some("state-1"));
        let scope = get("scope").unwrap();
        assert!(scope.contains("calendar.readonly"));
        assert!(!scope.contains("auth/calendar ") && !scope.ends_with("auth/calendar"));
    }

    #[test]
    fn reads_the_email_from_an_id_token() {
        let payload = URL_SAFE_NO_PAD.encode(br#"{"email":"dev.account@example.com"}"#);
        assert_eq!(
            email_from_id_token(&format!("header.{payload}.signature")).as_deref(),
            Some("dev.account@example.com")
        );
        assert_eq!(email_from_id_token("not-a-token"), None);
    }

    #[test]
    fn reads_the_expiry_from_an_id_token() {
        let payload = URL_SAFE_NO_PAD.encode(br#"{"email":"a@example.com","exp":1760000000}"#);
        assert_eq!(id_token_expiry_ms(&format!("h.{payload}.s")), Some(1_760_000_000_000));
        assert_eq!(id_token_expiry_ms("h.e30.s"), None);
    }

    #[test]
    fn reads_the_redirect_and_ignores_other_requests() {
        let params = redirect_params("GET /?state=s1&code=4%2F0Ab HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n").unwrap();
        assert!(params.contains(&("code".into(), "4/0Ab".into())));
        assert!(redirect_params("GET /favicon.ico HTTP/1.1\r\n\r\n").is_none());
    }
}
