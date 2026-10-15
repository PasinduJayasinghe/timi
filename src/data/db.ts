import Database from "@tauri-apps/plugin-sql";

/** Must match DB_URL in src-tauri/src/lib.rs, where the migrations are registered. */
const DB_URL = "sqlite:timi.db";

let connection: Promise<Database> | null = null;

/** The shared database connection, opened on first use. */
export function getDb(): Promise<Database> {
  if (!connection) {
    connection = Database.load(DB_URL).catch((error: unknown) => {
      // Allow a retry after a failed open
      connection = null;
      throw error;
    });
  }
  return connection;
}

/** Current time as a UTC ISO string. */
export function nowIso(): string {
  return new Date().toISOString();
}
