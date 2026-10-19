import { getDb } from "./db";

// Goals and a note per day (Plan tab, Phase 8a). Every write is a single statement, queued with
// queueWrite by the caller (see db.ts).

export type Goal = {
  id: string;
  dayKey: string;
  text: string;
  /** UTC ISO; null while not done. */
  doneAt: string | null;
  position: number;
};

/** At most this many goals a day (7a). */
export const MAX_GOALS = 3;

type GoalRow = { id: string; day_key: string; text: string; done_at: string | null; position: number };

function toGoal(row: GoalRow): Goal {
  return { id: row.id, dayKey: row.day_key, text: row.text, doneAt: row.done_at, position: row.position };
}

export async function listGoals(dayKey: string): Promise<Goal[]> {
  const db = await getDb();
  const rows = await db.select<GoalRow[]>(
    "SELECT id, day_key, text, done_at, position FROM day_goals WHERE day_key = $1 ORDER BY position",
    [dayKey],
  );
  return rows.map(toGoal);
}

export async function addGoal(goal: Goal, at: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    "INSERT INTO day_goals (id, day_key, text, done_at, position, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $6)",
    [goal.id, goal.dayKey, goal.text, goal.doneAt, goal.position, at],
  );
}

export async function setGoalText(id: string, text: string, at: string): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE day_goals SET text = $1, updated_at = $2 WHERE id = $3", [text, at, id]);
}

export async function setGoalDone(id: string, doneAt: string | null, at: string): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE day_goals SET done_at = $1, updated_at = $2 WHERE id = $3", [doneAt, at, id]);
}

export async function deleteGoal(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM day_goals WHERE id = $1", [id]);
}

export async function getNote(dayKey: string): Promise<string> {
  const db = await getDb();
  const rows = await db.select<Array<{ note: string }>>("SELECT note FROM day_notes WHERE day_key = $1", [dayKey]);
  return rows[0]?.note ?? "";
}

/** Saves a day's note; an empty note removes the row. */
export async function saveNote(dayKey: string, note: string, at: string): Promise<void> {
  const db = await getDb();
  if (note.trim() === "") {
    await db.execute("DELETE FROM day_notes WHERE day_key = $1", [dayKey]);
    return;
  }
  await db.execute(
    `INSERT INTO day_notes (day_key, note, updated_at) VALUES ($1, $2, $3)
     ON CONFLICT (day_key) DO UPDATE SET note = excluded.note, updated_at = excluded.updated_at`,
    [dayKey, note, at],
  );
}
