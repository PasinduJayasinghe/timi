import type { Note } from "../lib/notes";
import { getDb } from "./db";

// Quick notes (Phase 10). Every write is a single statement, queued with queueWrite by the caller.

type NoteRow = { id: string; body: string; pinned: number; created_at: string; updated_at: string };

function toNote(row: NoteRow): Note {
  return {
    id: row.id,
    body: row.body,
    pinned: row.pinned === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listNotes(): Promise<Note[]> {
  const db = await getDb();
  const rows = await db.select<NoteRow[]>(
    "SELECT id, body, pinned, created_at, updated_at FROM notes WHERE deleted_at IS NULL ORDER BY updated_at DESC",
  );
  return rows.map(toNote);
}

export async function createNote(note: Note): Promise<void> {
  const db = await getDb();
  await db.execute("INSERT INTO notes (id, body, pinned, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)", [
    note.id,
    note.body,
    note.pinned ? 1 : 0,
    note.createdAt,
    note.updatedAt,
  ]);
}

export async function updateBody(id: string, body: string, at: string): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE notes SET body = $1, updated_at = $2 WHERE id = $3", [body, at, id]);
}

/** Pinning doesn't count as an edit, so the note keeps its place among the others. */
export async function setPinned(id: string, pinned: boolean): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE notes SET pinned = $1 WHERE id = $2", [pinned ? 1 : 0, id]);
}

export async function softDelete(id: string, at: string): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE notes SET deleted_at = $1 WHERE id = $2", [at, id]);
}

export async function restore(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE notes SET deleted_at = NULL WHERE id = $1", [id]);
}
