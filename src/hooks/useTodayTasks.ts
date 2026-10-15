import { useCallback, useEffect, useRef, useState } from "react";
import * as taskStore from "../data/tasks";
import { nowIso, queueWrite, writesSettled } from "../data/db";
import type { TaskPatch } from "../data/tasks";
import type { Task } from "../data/types";
import { positionForMove, topPosition } from "../lib/position";

export type ListStatus = "loading" | "ready" | "error";

/** Display names that change together with a catalog patch. */
export type NamePatch = Partial<Pick<Task, "clientName" | "projectName">>;

/** Open tasks by position, then done tasks by position (1a). */
export function orderTasks(tasks: readonly Task[]): Task[] {
  const byPosition = (a: Task, b: Task): number => a.position - b.position;
  const open = tasks.filter((task) => !task.completedAt).sort(byPosition);
  const done = tasks.filter((task) => task.completedAt).sort(byPosition);
  return [...open, ...done];
}

/** The open or done group a task belongs to, in order. */
function groupOf(tasks: readonly Task[], task: Task): Task[] {
  return orderTasks(tasks).filter((other) => Boolean(other.completedAt) === Boolean(task.completedAt));
}

/** Fields for a new task. Anything left out starts empty. */
export type TaskDraft = Pick<Task, "title" | "type"> &
  Partial<Pick<Task, "clientId" | "clientName" | "projectId" | "projectName" | "ticketNumber" | "estimateMinutes">>;

export type TodayTasks = {
  status: ListStatus;
  tasks: Task[];
  reload: () => void;
  /** Adds a task at the top of the list and returns it. */
  add: (draft: TaskDraft) => Task;
  toggleDone: (id: string) => void;
  remove: (id: string) => Task | undefined;
  restore: (task: Task) => void;
  /** Moves a task to `toIndex` within its group (open or done). */
  moveTo: (id: string, toIndex: number) => void;
  /** Moves a task one step up (-1) or down (+1) within its group. */
  moveBy: (id: string, delta: -1 | 1) => void;
  update: (id: string, patch: TaskPatch, names?: NamePatch) => void;
};

/**
 * Today's task list. Carries unfinished tasks over when the day changes.
 * Changes apply optimistically; a failed write reloads from the database and calls `onSaveError`.
 */
export function useTodayTasks(day: string, onSaveError: () => void): TodayTasks {
  const [status, setStatus] = useState<ListStatus>("loading");
  const [tasks, setTasks] = useState<Task[]>([]);
  const tasksRef = useRef<Task[]>(tasks);
  tasksRef.current = tasks;
  const loadId = useRef(0);

  const load = useCallback(
    async (showLoading: boolean): Promise<void> => {
      const id = ++loadId.current;
      if (showLoading) setStatus("loading");
      try {
        await writesSettled();
        await taskStore.carryOver(day);
        const list = await taskStore.listForDay(day);
        if (id !== loadId.current) return;
        setTasks(list);
        setStatus("ready");
      } catch (error) {
        console.error("[tasks] load failed", error);
        if (id === loadId.current) setStatus("error");
      }
    },
    [day],
  );

  useEffect(() => {
    void load(true);
  }, [load]);

  const commit = useCallback(
    (change: (prev: Task[]) => Task[], write: () => Promise<void>): void => {
      setTasks(change);
      queueWrite(write).catch((error: unknown) => {
        console.error("[tasks] save failed", error);
        onSaveError();
        void load(false);
      });
    },
    [load, onSaveError],
  );

  const add = useCallback(
    (draft: TaskDraft): Task => {
      const createdAt = nowIso();
      const task: Task = {
        id: crypto.randomUUID(),
        title: draft.title,
        type: draft.type,
        clientId: draft.clientId ?? null,
        clientName: draft.clientName ?? null,
        projectId: draft.projectId ?? null,
        projectName: draft.projectName ?? null,
        ticketNumber: draft.ticketNumber ?? null,
        notes: "",
        estimateMinutes: draft.estimateMinutes ?? null,
        listDay: day,
        carriedFrom: null,
        position: topPosition(tasksRef.current.map((t) => t.position)),
        completedAt: null,
        createdAt,
        updatedAt: createdAt,
      };
      commit(
        (prev) => [...prev, task],
        () => taskStore.create(task),
      );
      return task;
    },
    [commit, day],
  );

  const toggleDone = useCallback(
    (id: string): void => {
      const task = tasksRef.current.find((t) => t.id === id);
      if (!task) return;
      const completedAt = task.completedAt ? null : nowIso();
      commit(
        (prev) => prev.map((t) => (t.id === id ? { ...t, completedAt } : t)),
        () => taskStore.setCompleted(id, completedAt),
      );
    },
    [commit],
  );

  const remove = useCallback(
    (id: string): Task | undefined => {
      const task = tasksRef.current.find((t) => t.id === id);
      if (!task) return undefined;
      commit(
        (prev) => prev.filter((t) => t.id !== id),
        () => taskStore.softDelete(id),
      );
      return task;
    },
    [commit],
  );

  const restore = useCallback(
    (task: Task): void => {
      commit(
        (prev) => (prev.some((t) => t.id === task.id) ? prev : [...prev, task]),
        () => taskStore.restore(task.id),
      );
    },
    [commit],
  );

  const moveTo = useCallback(
    (id: string, toIndex: number): void => {
      const task = tasksRef.current.find((t) => t.id === id);
      if (!task) return;
      const group = groupOf(tasksRef.current, task);
      const from = group.findIndex((t) => t.id === id);
      const to = Math.max(0, Math.min(group.length - 1, toIndex));
      if (from === to) return;
      const position = positionForMove(
        group.map((t) => t.position),
        from,
        to,
      );
      commit(
        (prev) => prev.map((t) => (t.id === id ? { ...t, position } : t)),
        () => taskStore.move(id, position),
      );
    },
    [commit],
  );

  const moveBy = useCallback(
    (id: string, delta: -1 | 1): void => {
      const task = tasksRef.current.find((t) => t.id === id);
      if (!task) return;
      const index = groupOf(tasksRef.current, task).findIndex((t) => t.id === id);
      moveTo(id, index + delta);
    },
    [moveTo],
  );

  const update = useCallback(
    (id: string, patch: TaskPatch, names: NamePatch = {}): void => {
      commit(
        (prev) => prev.map((t) => (t.id === id ? { ...t, ...patch, ...names } : t)),
        () => taskStore.update(id, patch),
      );
    },
    [commit],
  );

  const reload = useCallback((): void => {
    void load(true);
  }, [load]);

  return { status, tasks, reload, add, toggleDone, remove, restore, moveTo, moveBy, update };
}
