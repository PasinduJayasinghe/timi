import { useCallback, useEffect, useRef, useState } from "react";
import { nowIso, queueWrite, writesSettled } from "../data/db";
import * as noteStore from "../data/notes";
import { sortNotes, type Note } from "../lib/notes";
import type { ListStatus } from "./useTodayTasks";

export type Notes = {
  status: ListStatus;
  /** Pinned first, then newest edit first (8a). */
  notes: Note[];
  reload: () => void;
  /** Adds a note and returns it. */
  create: (body: string) => Note;
  updateBody: (id: string, body: string) => void;
  togglePin: (id: string) => void;
  /** Deletes a note and returns it, for Undo. */
  remove: (id: string) => Note | undefined;
  restore: (note: Note) => void;
};

/** Quick notes (Phase 10). Changes apply optimistically; a failed write reloads and calls `onSaveError`. */
export function useNotes(onSaveError: () => void): Notes {
  const [status, setStatus] = useState<ListStatus>("loading");
  const [notes, setNotes] = useState<Note[]>([]);
  const notesRef = useRef(notes);
  notesRef.current = notes;
  const loadId = useRef(0);

  const load = useCallback(async (): Promise<void> => {
    const id = ++loadId.current;
    setStatus("loading");
    try {
      await writesSettled();
      const list = await noteStore.listNotes();
      if (id !== loadId.current) return;
      setNotes(sortNotes(list));
      setStatus("ready");
    } catch (error) {
      console.error("[notes] load failed", error);
      if (id === loadId.current) setStatus("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const commit = useCallback(
    (change: (prev: Note[]) => Note[], write: () => Promise<void>): void => {
      setNotes((prev) => sortNotes(change(prev)));
      queueWrite(write).catch((error: unknown) => {
        console.error("[notes] save failed", error);
        onSaveError();
        void load();
      });
    },
    [load, onSaveError],
  );

  const create = useCallback(
    (body: string): Note => {
      const at = nowIso();
      const note: Note = { id: crypto.randomUUID(), body, pinned: false, createdAt: at, updatedAt: at };
      commit(
        (prev) => [...prev, note],
        () => noteStore.createNote(note),
      );
      return note;
    },
    [commit],
  );

  const updateBody = useCallback(
    (id: string, body: string): void => {
      const note = notesRef.current.find((n) => n.id === id);
      if (!note || note.body === body) return;
      const at = nowIso();
      commit(
        (prev) => prev.map((n) => (n.id === id ? { ...n, body, updatedAt: at } : n)),
        () => noteStore.updateBody(id, body, at),
      );
    },
    [commit],
  );

  const togglePin = useCallback(
    (id: string): void => {
      const note = notesRef.current.find((n) => n.id === id);
      if (!note) return;
      const pinned = !note.pinned;
      commit(
        (prev) => prev.map((n) => (n.id === id ? { ...n, pinned } : n)),
        () => noteStore.setPinned(id, pinned),
      );
    },
    [commit],
  );

  const remove = useCallback(
    (id: string): Note | undefined => {
      const note = notesRef.current.find((n) => n.id === id);
      if (!note) return undefined;
      commit(
        (prev) => prev.filter((n) => n.id !== id),
        () => noteStore.softDelete(id, nowIso()),
      );
      return note;
    },
    [commit],
  );

  const restore = useCallback(
    (note: Note): void => {
      commit(
        (prev) => (prev.some((n) => n.id === note.id) ? prev : [...prev, note]),
        () => noteStore.restore(note.id),
      );
    },
    [commit],
  );

  const reload = useCallback((): void => {
    void load();
  }, [load]);

  return { status, notes, reload, create, updateBody, togglePin, remove, restore };
}
