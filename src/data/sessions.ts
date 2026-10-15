import { getDb } from "./db";
import { toSession, toTask, type Session, type SessionRow, type Task, type TaskRow } from "./types";

// Every write is a single statement, queued with queueWrite by the caller (see db.ts).

const SELECT_SESSIONS = `
  SELECT s.id, s.task_id, s.started_at, s.ended_at, s.last_seen_at,
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
 * Sessions that started in [startIso, endIso), oldest first. Includes sessions of deleted
 * tasks, because that time was still worked.
 */
export async function listBetween(startIso: string, endIso: string): Promise<Session[]> {
  const db = await getDb();
  const rows = await db.select<SessionRow[]>(
    `${SELECT_SESSIONS} WHERE s.started_at >= $1 AND s.started_at < $2 ORDER BY s.started_at`,
    [startIso, endIso],
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

export type NewSession = { id: string; taskId: string; startedAt: string };

export async function insert(session: NewSession): Promise<void> {
  const db = await getDb();
  await db.execute(
    "INSERT INTO sessions (id, task_id, started_at, last_seen_at, created_at) VALUES ($1, $2, $3, $3, $3)",
    [session.id, session.taskId, session.startedAt],
  );
}

/** Closes whichever session is open. */
export async function stopRunning(endedAt: string): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE sessions SET ended_at = $1 WHERE ended_at IS NULL", [endedAt]);
}

/** Closes one session, if it is still open. */
export async function stop(id: string, endedAt: string): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE sessions SET ended_at = $1 WHERE id = $2 AND ended_at IS NULL", [endedAt, id]);
}

export async function heartbeat(id: string, seenAt: string): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE sessions SET last_seen_at = $1 WHERE id = $2 AND ended_at IS NULL", [seenAt, id]);
}

/** Reopens a closed session (Undo). Returns false if another session is running. */
export async function reopen(id: string, seenAt: string): Promise<boolean> {
  const db = await getDb();
  const result = await db.execute(
    `UPDATE sessions SET ended_at = NULL, last_seen_at = $1
     WHERE id = $2 AND NOT EXISTS (SELECT 1 FROM sessions WHERE ended_at IS NULL)`,
    [seenAt, id],
  );
  return result.rowsAffected > 0;
}

export type RecentTask = { task: Task; lastStartedAt: string };

type RecentRow = TaskRow & { last_started_at: string };

/** Tasks most recently timed, newest first (2a "Recent"). Deleted tasks are left out. */
export async function recentTasks(limit: number): Promise<RecentTask[]> {
  const db = await getDb();
  const rows = await db.select<RecentRow[]>(
    `SELECT t.id, t.title, t.type, t.client_id, c.name AS client_name, t.project_id, p.name AS project_name,
            t.ticket_number, t.notes, t.estimate_minutes, t.list_day, t.carried_from, t.position,
            t.remind_at, t.calendar_event_id, t.completed_at, t.created_at, t.updated_at,
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
