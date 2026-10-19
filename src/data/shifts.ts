import type { Shift } from "../lib/shift";
import { getDb } from "./db";

// Every write is a single statement, queued with queueWrite by the caller (see db.ts).

type ShiftRow = {
  id: string;
  day_key: string;
  started_at: string;
  ended_at: string | null;
  ended_by: string | null;
  noticed_at: string | null;
};

const SELECT_SHIFTS = "SELECT id, day_key, started_at, ended_at, ended_by, noticed_at FROM shifts";

function toShift(row: ShiftRow): Shift {
  return {
    id: row.id,
    dayKey: row.day_key,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    endedBy: row.ended_by === "user" || row.ended_by === "auto" ? row.ended_by : null,
    noticedAt: row.noticed_at,
  };
}

/** The open shift, if any. The database allows only one. */
export async function getOpen(): Promise<Shift | null> {
  const db = await getDb();
  const rows = await db.select<ShiftRow[]>(`${SELECT_SHIFTS} WHERE ended_at IS NULL LIMIT 1`);
  return rows[0] ? toShift(rows[0]) : null;
}

/** The most recent shift by day, open or ended. */
export async function getLatest(): Promise<Shift | null> {
  const db = await getDb();
  const rows = await db.select<ShiftRow[]>(`${SELECT_SHIFTS} ORDER BY day_key DESC LIMIT 1`);
  return rows[0] ? toShift(rows[0]) : null;
}

/** Starts a shift. A shift already on that day is reopened instead (Reopen, 7k). */
export async function start(shift: Pick<Shift, "id" | "dayKey" | "startedAt">): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO shifts (id, day_key, started_at, created_at, updated_at) VALUES ($1, $2, $3, $3, $3)
     ON CONFLICT (day_key) DO UPDATE SET ended_at = NULL, ended_by = NULL, noticed_at = NULL, updated_at = $3`,
    [shift.id, shift.dayKey, shift.startedAt],
  );
}

/** Ends a shift, if it is still open. */
export async function end(id: string, endedAt: string, by: "user" | "auto"): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE shifts SET ended_at = $1, ended_by = $2, updated_at = $1 WHERE id = $3 AND ended_at IS NULL",
    [endedAt, by, id],
  );
}

/** Reopens an ended shift (7k). Returns false if another shift is open. */
export async function reopen(id: string, at: string): Promise<boolean> {
  const db = await getDb();
  const result = await db.execute(
    `UPDATE shifts SET ended_at = NULL, ended_by = NULL, noticed_at = NULL, updated_at = $1
     WHERE id = $2 AND NOT EXISTS (SELECT 1 FROM shifts WHERE ended_at IS NULL)`,
    [at, id],
  );
  return result.rowsAffected > 0;
}

/** Dismisses the "ended for you" note (7l). */
export async function markNoticed(id: string, at: string): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE shifts SET noticed_at = $1 WHERE id = $2", [at, id]);
}

/** The last moment anything was timed on a day (end, last seen or start of its latest session). */
export async function lastActivity(dayKey: string): Promise<number | null> {
  const db = await getDb();
  const rows = await db.select<Array<{ last: string | null }>>(
    "SELECT MAX(COALESCE(ended_at, last_seen_at, started_at)) AS last FROM sessions WHERE day_key = $1",
    [dayKey],
  );
  const last = rows[0]?.last;
  return last ? Date.parse(last) : null;
}
