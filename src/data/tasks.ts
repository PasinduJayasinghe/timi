import { getDb, nowIso } from "./db";
import { toTask, type Task, type TaskRow } from "./types";

// Every write is a single statement: the SQL plugin uses a connection pool,
// so BEGIN/COMMIT sent as separate calls could land on different connections.

const SELECT_TASKS = `
  SELECT t.id, t.title, t.type, t.client_id, c.name AS client_name, t.project_id, p.name AS project_name,
         t.ticket_number, t.notes, t.estimate_minutes, t.list_day, t.carried_from, t.position,
         t.remind_at, t.calendar_event_id, t.completed_at, t.created_at, t.updated_at
  FROM tasks t
  LEFT JOIN clients c ON c.id = t.client_id
  LEFT JOIN projects p ON p.id = t.project_id`;

export async function listForDay(day: string): Promise<Task[]> {
  const db = await getDb();
  const rows = await db.select<TaskRow[]>(
    `${SELECT_TASKS} WHERE t.list_day = $1 AND t.deleted_at IS NULL ORDER BY t.position`,
    [day],
  );
  return rows.map(toTask);
}

export type NewTask = Pick<
  Task,
  | "id"
  | "title"
  | "type"
  | "clientId"
  | "projectId"
  | "ticketNumber"
  | "notes"
  | "estimateMinutes"
  | "listDay"
  | "position"
  | "createdAt"
  | "calendarEventId"
>;

export async function create(task: NewTask): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO tasks (id, title, type, client_id, project_id, ticket_number, notes, estimate_minutes,
                        list_day, position, created_at, updated_at, calendar_event_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11, $12)`,
    [
      task.id,
      task.title,
      task.type,
      task.clientId,
      task.projectId,
      task.ticketNumber,
      task.notes,
      task.estimateMinutes,
      task.listDay,
      task.position,
      task.createdAt,
      task.calendarEventId,
    ],
  );
}

/** Fields the details popover can change. */
export type TaskPatch = Partial<
  Pick<Task, "title" | "type" | "clientId" | "projectId" | "ticketNumber" | "notes" | "estimateMinutes" | "remindAt">
>;

const PATCH_COLUMNS: Record<keyof TaskPatch, string> = {
  title: "title",
  type: "type",
  clientId: "client_id",
  projectId: "project_id",
  ticketNumber: "ticket_number",
  notes: "notes",
  estimateMinutes: "estimate_minutes",
  remindAt: "remind_at",
};

export async function update(id: string, patch: TaskPatch): Promise<void> {
  const keys = (Object.keys(patch) as Array<keyof TaskPatch>).filter((key) => patch[key] !== undefined);
  if (keys.length === 0) return;

  const assignments = keys.map((key, index) => `${PATCH_COLUMNS[key]} = $${index + 1}`);
  const values = keys.map((key) => patch[key] ?? null);
  const db = await getDb();
  await db.execute(
    `UPDATE tasks SET ${assignments.join(", ")}, updated_at = $${keys.length + 1} WHERE id = $${keys.length + 2}`,
    [...values, nowIso(), id],
  );
}

export async function setCompleted(id: string, completedAt: string | null): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE tasks SET completed_at = $1, updated_at = $2 WHERE id = $3", [completedAt, nowIso(), id]);
}

/** Soft delete, so Undo and future session history keep working. */
export async function softDelete(id: string): Promise<void> {
  const db = await getDb();
  const now = nowIso();
  await db.execute("UPDATE tasks SET deleted_at = $1, updated_at = $1 WHERE id = $2", [now, id]);
}

export async function restore(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE tasks SET deleted_at = NULL, updated_at = $1 WHERE id = $2", [nowIso(), id]);
}

export async function move(id: string, position: number): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE tasks SET position = $1, updated_at = $2 WHERE id = $3", [position, nowIso(), id]);
}

/** Moves unfinished tasks from earlier days onto `today`. Returns how many moved. */
export async function carryOver(today: string): Promise<number> {
  const db = await getDb();
  const result = await db.execute(
    `UPDATE tasks SET carried_from = list_day, list_day = $1, updated_at = $2
     WHERE completed_at IS NULL AND deleted_at IS NULL AND list_day < $1`,
    [today, nowIso()],
  );
  return result.rowsAffected;
}
