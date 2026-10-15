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

// Writes run one after another: the SQL plugin's connection pool could otherwise run an
// UPDATE before the INSERT it depends on (which changes no rows and fails silently), or a
// session INSERT before its task exists (which breaks the foreign key).
let writes: Promise<void> = Promise.resolve();

/** Runs `write` after every write queued before it. The returned promise rejects if `write` fails. */
export function queueWrite<T>(write: () => Promise<T>): Promise<T> {
  const run = writes.then(write);
  writes = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/** Resolves once every write queued so far has finished, so a read sees them. */
export function writesSettled(): Promise<void> {
  return writes;
}
