import type { Session, Task } from "../data/types";
import { sessionSeconds } from "./sessionMath";
import { displayTitle, sessionDisplay, whereLabel, type DisplayFields } from "./taskDisplay";
import { styleOf } from "./taskTypes";

/** A row of the Tasks sheet (9d): a task on one work day. */
export type TaskExportRow = {
  day: string;
  title: string;
  typeLabel: string;
  whereLabel: string;
  estimateMinutes: number | null;
  trackedSeconds: number;
  done: boolean;
};

/** A row of the Sessions sheet (9d). Times are local, "YYYY-MM-DDThh:mm:ss". */
export type SessionExportRow = {
  day: string;
  title: string;
  typeLabel: string;
  whereLabel: string;
  start: string;
  end: string;
  seconds: number;
};

export type ExportData = {
  tasks: TaskExportRow[];
  sessions: SessionExportRow[];
  /** Days with tracked time, for the summary (9b). */
  days: number;
  trackedSeconds: number;
};

/** Local time as "YYYY-MM-DDThh:mm:ss", the form Excel reads as a date and time. */
export function localIso(ms: number): string {
  const date = new Date(ms);
  const pad = (value: number): string => String(value).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

const labels = (fields: DisplayFields): Pick<TaskExportRow, "title" | "typeLabel" | "whereLabel"> => ({
  title: displayTitle(fields),
  typeLabel: styleOf(fields).label,
  whereLabel: whereLabel(fields) ?? "",
});

type Draft = TaskExportRow & { taskId: string; firstStart: number };

/**
 * The workbook's rows for a range of days: one task row per task per work day it was listed on or
 * timed on (its sessions' days, split by shift), and one row per session. A running session
 * counts up to now.
 */
export function buildExport(tasks: readonly Task[], sessions: readonly Session[], nowMs: number): ExportData {
  const rows = new Map<string, Draft>();
  const byTask = new Map(tasks.map((task) => [task.id, task]));
  const sorted = [...sessions].sort((a, b) => a.startedAt.localeCompare(b.startedAt));

  for (const session of sorted) {
    const key = `${session.taskId}|${session.dayKey}`;
    const seconds = sessionSeconds(session, nowMs);
    const row = rows.get(key);
    if (row) {
      row.trackedSeconds += seconds;
    } else {
      const task = byTask.get(session.taskId);
      rows.set(key, {
        taskId: session.taskId,
        day: session.dayKey,
        ...labels(task ?? sessionDisplay(session)),
        estimateMinutes: task?.estimateMinutes ?? null,
        trackedSeconds: seconds,
        done: false,
        firstStart: Date.parse(session.startedAt),
      });
    }
  }
  for (const task of tasks) {
    const key = `${task.id}|${task.listDay}`;
    if (!rows.has(key)) {
      rows.set(key, {
        taskId: task.id,
        day: task.listDay,
        ...labels(task),
        estimateMinutes: task.estimateMinutes,
        trackedSeconds: 0,
        done: false,
        firstStart: Number.POSITIVE_INFINITY,
      });
    }
  }

  // A finished task is done on the last day it appears
  const lastDay = new Map<string, string>();
  for (const row of rows.values()) {
    if ((lastDay.get(row.taskId) ?? "") < row.day) lastDay.set(row.taskId, row.day);
  }
  const taskRows = [...rows.values()]
    .map((row) => ({
      ...row,
      done: Boolean(byTask.get(row.taskId)?.completedAt) && lastDay.get(row.taskId) === row.day,
    }))
    .sort((a, b) => a.day.localeCompare(b.day) || a.firstStart - b.firstStart || a.title.localeCompare(b.title))
    .map(({ taskId: _taskId, firstStart: _firstStart, ...row }) => row);

  const sessionRows = sorted.map((session) => {
    const startMs = Date.parse(session.startedAt);
    const seconds = sessionSeconds(session, nowMs);
    return {
      day: session.dayKey,
      ...labels(sessionDisplay(session)),
      start: localIso(startMs),
      end: localIso(session.endedAt ? Date.parse(session.endedAt) : nowMs),
      seconds,
    };
  });

  return {
    tasks: taskRows,
    sessions: sessionRows,
    days: new Set(sorted.map((session) => session.dayKey)).size,
    trackedSeconds: sessionRows.reduce((sum, row) => sum + row.seconds, 0),
  };
}

/** "Timi 2026-10-16.xlsx", or "Timi 2026-10-12 to 2026-10-18.xlsx" for a range (9c). */
export function exportFileName(fromDay: string, toDay: string): string {
  return fromDay === toDay ? `Timi ${fromDay}.xlsx` : `Timi ${fromDay} to ${toDay}.xlsx`;
}
