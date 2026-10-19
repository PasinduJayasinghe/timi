import { useCallback, useEffect, useRef, useState } from "react";
import { nowIso, queueWrite, writesSettled } from "../data/db";
import * as planStore from "../data/plans";
import { MAX_GOALS, type Goal } from "../data/plans";
import type { ListStatus } from "./useTodayTasks";

export type DayPlan = {
  status: ListStatus;
  goals: Goal[];
  note: string;
  reload: () => void;
  /** Adds a goal, unless the day already has MAX_GOALS. */
  addGoal: (text: string) => void;
  toggleGoal: (id: string) => void;
  /** Renames a goal; an empty text deletes it. */
  renameGoal: (id: string, text: string) => void;
  setNote: (note: string) => void;
};

/**
 * Goals and the note of a day (7a). Pass null to load nothing. Changes apply optimistically; a
 * failed write reloads from the database and calls `onSaveError`.
 */
export function useDayPlan(dayKey: string | null, onSaveError: () => void): DayPlan {
  const [status, setStatus] = useState<ListStatus>("loading");
  const [goals, setGoals] = useState<Goal[]>([]);
  const [note, setNoteState] = useState("");
  const goalsRef = useRef(goals);
  goalsRef.current = goals;
  const loadId = useRef(0);

  const load = useCallback(async (): Promise<void> => {
    const id = ++loadId.current;
    if (dayKey === null) return;
    setStatus("loading");
    try {
      await writesSettled();
      const [list, text] = await Promise.all([planStore.listGoals(dayKey), planStore.getNote(dayKey)]);
      if (id !== loadId.current) return;
      setGoals(list);
      setNoteState(text);
      setStatus("ready");
    } catch (error) {
      console.error("[plan] load failed", error);
      if (id === loadId.current) setStatus("error");
    }
  }, [dayKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const write = useCallback(
    (run: () => Promise<void>): void => {
      queueWrite(run).catch((error: unknown) => {
        console.error("[plan] save failed", error);
        onSaveError();
        void load();
      });
    },
    [load, onSaveError],
  );

  const addGoal = useCallback(
    (text: string): void => {
      const value = text.trim();
      if (dayKey === null || value === "" || goalsRef.current.length >= MAX_GOALS) return;
      const last = goalsRef.current[goalsRef.current.length - 1];
      const goal: Goal = {
        id: crypto.randomUUID(),
        dayKey,
        text: value,
        doneAt: null,
        position: (last?.position ?? 0) + 1,
      };
      setGoals((list) => [...list, goal]);
      write(() => planStore.addGoal(goal, nowIso()));
    },
    [dayKey, write],
  );

  const toggleGoal = useCallback(
    (id: string): void => {
      const goal = goalsRef.current.find((g) => g.id === id);
      if (!goal) return;
      const doneAt = goal.doneAt ? null : nowIso();
      setGoals((list) => list.map((g) => (g.id === id ? { ...g, doneAt } : g)));
      write(() => planStore.setGoalDone(id, doneAt, nowIso()));
    },
    [write],
  );

  const renameGoal = useCallback(
    (id: string, text: string): void => {
      const value = text.trim();
      const goal = goalsRef.current.find((g) => g.id === id);
      if (!goal || goal.text === value) return;
      if (value === "") {
        setGoals((list) => list.filter((g) => g.id !== id));
        write(() => planStore.deleteGoal(id));
        return;
      }
      setGoals((list) => list.map((g) => (g.id === id ? { ...g, text: value } : g)));
      write(() => planStore.setGoalText(id, value, nowIso()));
    },
    [write],
  );

  const setNote = useCallback(
    (next: string): void => {
      if (dayKey === null) return;
      setNoteState(next);
      write(() => planStore.saveNote(dayKey, next, nowIso()));
    },
    [dayKey, write],
  );

  const reload = useCallback((): void => {
    void load();
  }, [load]);

  return { status, goals, note, reload, addGoal, toggleGoal, renameGoal, setNote };
}
