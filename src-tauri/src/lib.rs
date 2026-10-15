use tauri_plugin_sql::{Migration, MigrationKind};

/// Database URL used by the front end (`Database.load`). The file lives in the app config folder.
const DB_URL: &str = "sqlite:timi.db";

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
    ]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(DB_URL, migrations())
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
