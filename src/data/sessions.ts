import { getDb } from "./db";
import { toSession, toTask, type Session, type SessionRow, type Task, type TaskRow } from "./types";

// Every write is a single statement, queued with queueWrite by the caller (see db.ts).

const SELECT_SESSIONS = `
  SELECT s.id, s.task_id, s.day_key, s.started_at, s.ended_at, s.last_seen_at,
         t.title AS task_title, t.type AS task_type, t.ticket_number,
         c.name AS client_name, p.name AS project_name, t.calendar_event_id
  FROM sessions s
  JOIN tasks t ON t.id = s.task_id
  LEFT JOIN clients c ON c.id = t.client_id
  LEFT JOIN projects p ON p.id = t.project_id`;

/** The open session, if any. The database allows only one. */
export async function getRunning(): Promise<Session | null> {
  const db = await getDb();
  const rows = await db.select<SessionRow[]>(`${SELECT_SESSIONS} WHERE s.ended_at IS NULL LIMIT 1`);
  return rows[0] ? toSession(rows[0]) : null;
}

/**
 * Sessions of the work days in [fromDay, toDay) ("YYYY-MM-DD"), oldest first. Includes sessions
 * of deleted tasks, because that time was still worked.
 */
export async function listForDays(fromDay: string, toDay: string): Promise<Session[]> {
  const db = await getDb();
  const rows = await db.select<SessionRow[]>(
    `${SELECT_SESSIONS} WHERE s.day_key >= $1 AND s.day_key < $2 ORDER BY s.started_at`,
    [fromDay, toDay],
  );
  return rows.map(toSession);
}

/** Closed sessions of the given tasks, across all days. */
export async function listClosedForTasks(taskIds: readonly string[]): Promise<Session[]> {
  if (taskIds.length === 0) return [];
  const db = await getDb();
  const placeholders = taskIds.map((_, index) => `$${index + 1}`).join(", ");
  const rows = await db.select<SessionRow[]>(
    `${SELECT_SESSIONS} WHERE s.ended_at IS NOT NULL AND s.task_id IN (${placeholders})`,
    [...taskIds],
  );
  return rows.map(toSession);
}

/** `dayKey` is the open shift's day (Phase 7). */
export type NewSession = { id: string; taskId: string; dayKey: string; startedAt: string };

export async function insert(session: NewSession): Promise<void> {
  const db = await getDb();
  await db.execute(
    "INSERT INTO sessions (id, task_id, day_key, started_at, last_seen_at, created_at) VALUES ($1, $2, $3, $4, $4, $4)",
    [session.id, session.taskId, session.dayKey, session.startedAt],
  );
}

/** Closes whichever session is open. */
export async function stopRunning(endedAt: string): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE sessions SET ended_at = $1, synced_at = NULL WHERE ended_at IS NULL", [endedAt]);
}

/** Closes one session, if it is still open. */
export async function stop(id: string, endedAt: string): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE sessions SET ended_at = $1, synced_at = NULL WHERE id = $2 AND ended_at IS NULL", [
    endedAt,
    id,
  ]);
}

export async function heartbeat(id: string, seenAt: string): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE sessions SET last_seen_at = $1 WHERE id = $2 AND ended_at IS NULL", [seenAt, id]);
}

/** Reopens a closed session (Undo). Returns false if another session is running. */
export async function reopen(id: string, seenAt: string): Promise<boolean> {
  const db = await getDb();
  const result = await db.execute(
    `UPDATE sessions SET ended_at = NULL, synced_at = NULL, last_seen_at = $1
     WHERE id = $2 AND NOT EXISTS (SELECT 1 FROM sessions WHERE ended_at IS NULL)`,
    [seenAt, id],
  );
  return result.rowsAffected > 0;
}

/** A closed session waiting to upload, with its task details (Phase 6a). */
export type PendingUpload = {
  id: string;
  taskId: string;
  taskTitle: string;
  taskType: string;
  clientName: string | null;
  projectName: string | null;
  ticketNumber: string | null;
  calendarEventId: string | null;
  /** The work day it belongs to, "YYYY-MM-DD". */
  dayKey: string;
  startedAt: string;
  endedAt: string;
};

type PendingRow = {
  id: string;
  task_id: string;
  task_title: string;
  task_type: string;
  client_name: string | null;
  project_name: string | null;
  ticket_number: string | null;
  calendar_event_id: string | null;
  day_key: string;
  started_at: string;
  ended_at: string;
};

/** Closed sessions not uploaded yet, or whose task changed since (e.g. renamed). Oldest first. */
const PENDING = `s.ended_at IS NOT NULL AND (s.synced_at IS NULL OR s.synced_at < t.updated_at)`;

export async function listPendingUploads(limit: number): Promise<PendingUpload[]> {
  const db = await getDb();
  const rows = await db.select<PendingRow[]>(
    `SELECT s.id, s.task_id, t.title AS task_title, t.type AS task_type, c.name AS client_name,
            p.name AS project_name, t.ticket_number, t.calendar_event_id, s.day_key, s.started_at, s.ended_at
     FROM sessions s
     JOIN tasks t ON t.id = s.task_id
     LEFT JOIN clients c ON c.id = t.client_id
     LEFT JOIN projects p ON p.id = t.project_id
     WHERE ${PENDING}
     ORDER BY s.started_at
     LIMIT $1`,
    [limit],
  );
  return rows.map((row) => ({
    id: row.id,
    taskId: row.task_id,
    taskTitle: row.task_title,
    taskType: row.task_type,
    clientName: row.client_name,
    projectName: row.project_name,
    ticketNumber: row.ticket_number,
    calendarEventId: row.calendar_event_id,
    dayKey: row.day_key,
    startedAt: row.started_at,
    endedAt: row.ended_at,
  }));
}

export async function countPendingUploads(): Promise<number> {
  const db = await getDb();
  const rows = await db.select<Array<{ count: number }>>(
    `SELECT COUNT(*) AS count FROM sessions s JOIN tasks t ON t.id = s.task_id WHERE ${PENDING}`,
  );
  return rows[0]?.count ?? 0;
}

/**
 * Marks uploaded sessions as synced at `listedAt` (when they were read for upload), so a task edit
 * or a session change made during the upload still counts as waiting. A session whose end
 * changed meanwhile (closed again after Undo) is left waiting too.
 */
export async function markSynced(
  sessions: ReadonlyArray<Pick<PendingUpload, "id" | "endedAt">>,
  listedAt: string,
): Promise<void> {
  if (sessions.length === 0) return;
  const db = await getDb();
  const conditions = sessions.map((_, index) => `(id = $${index * 2 + 2} AND ended_at = $${index * 2 + 3})`);
  await db.execute(`UPDATE sessions SET synced_at = $1 WHERE ${conditions.join(" OR ")}`, [
    listedAt,
    ...sessions.flatMap((session) => [session.id, session.endedAt]),
  ]);
}

export type RecentTask = { task: Task; lastStartedAt: string };

type RecentRow = TaskRow & { last_started_at: string };

/** Tasks most recently timed, newest first (2a "Recent"). Deleted tasks are left out. */
export async function recentTasks(limit: number): Promise<RecentTask[]> {
  const db = await getDb();
  const rows = await db.select<RecentRow[]>(
    `SELECT t.id, t.title, t.type, t.client_id, c.name AS client_name, t.project_id, p.name AS project_name,
            t.ticket_number, t.notes, t.estimate_minutes, t.list_day, t.carried_from, t.position,
            t.remind_at, t.calendar_event_id, t.planned_start, t.planned_minutes, t.completed_at, t.created_at, t.updated_at,
            MAX(s.started_at) AS last_started_at
     FROM sessions s
     JOIN tasks t ON t.id = s.task_id
     LEFT JOIN clients c ON c.id = t.client_id
     LEFT JOIN projects p ON p.id = t.project_id
     WHERE t.deleted_at IS NULL
     GROUP BY t.id
     ORDER BY last_started_at DESC
     LIMIT $1`,
    [limit],
  );
  return rows.map((row) => ({ task: toTask(row), lastStartedAt: row.last_started_at }));
}
