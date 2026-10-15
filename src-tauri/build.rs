use std::fs;

/// Google OAuth client for Calendar sign-in, read from the gitignored `.env` at the project root
/// (see `.env.example`). Environment variables of the same name win, e.g. on a build machine.
const OAUTH_KEYS: [&str; 2] = ["TIMI_GOOGLE_CLIENT_ID", "TIMI_GOOGLE_CLIENT_SECRET"];

fn main() {
    println!("cargo:rerun-if-changed=../.env");
    let dotenv = fs::read_to_string("../.env").unwrap_or_default();
    for key in OAUTH_KEYS {
        println!("cargo:rerun-if-env-changed={key}");
        let from_env = std::env::var(key).ok().filter(|value| !value.is_empty());
        let from_file = dotenv.lines().find_map(|line| {
            let (name, value) = line.split_once('=')?;
            (name.trim() == key).then(|| value.trim().trim_matches('"').to_string())
        });
        if let Some(value) = from_env.or(from_file).filter(|value| !value.is_empty()) {
            println!("cargo:rustc-env={key}={value}");
        }
    }

    tauri_build::build()
}
