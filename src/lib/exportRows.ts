import type { Session } from "../data/types";
import { sessionSeconds } from "./sessionMath";
import { displayTitle, sessionDisplay } from "./taskDisplay";
import { styleOf, TYPE_FIELDS } from "./taskTypes";

/**
 * One row of the hours sheet, in the columns of the timesheet template (Phase 12): Date, Start,
 * Finish, Kind of work, Clients, Project, What you worked on, Note.
 */
export type TimesheetRow = {
  /** The session's work day, "YYYY-MM-DD" (a night shift keeps its date after midnight). */
  date: string;
  /** Local time, "YYYY-MM-DDThh:mm:ss", written to Excel as a 24-hour time. */
  start: string;
  finish: string;
  kindOfWork: string;
  clients: string;
  project: string;
  workedOn: string;
  note: string;
};

export type ExportData = {
  rows: TimesheetRow[];
  /** Days with tracked time, tasks timed and time tracked, for the summary (9b). */
  days: number;
  tasks: number;
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

/** Notes on one line: a cell can't hold the line breaks of the task's notes. */
function oneLine(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .join("; ");
}

/**
 * The hours sheet's rows for a range of days: one row per timer session, oldest first. A running
 * session finishes now. `notes` holds each task's notes by task id.
 */
export function buildExport(
  sessions: readonly Session[],
  notes: ReadonlyMap<string, string>,
  nowMs: number,
): ExportData {
  const sorted = [...sessions].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const rows = sorted.map((session): TimesheetRow => {
    const task = sessionDisplay(session);
    const fields = TYPE_FIELDS[task.type];
    return {
      date: session.dayKey,
      start: localIso(Date.parse(session.startedAt)),
      finish: localIso(session.endedAt ? Date.parse(session.endedAt) : nowMs),
      kindOfWork: styleOf(task).short,
      clients: fields.client !== "none" ? (task.clientName ?? "") : "",
      project: fields.project !== "none" ? (task.projectName ?? "") : "",
      workedOn: displayTitle(task),
      note: oneLine(notes.get(session.taskId) ?? ""),
    };
  });
  return {
    rows,
    days: new Set(sorted.map((session) => session.dayKey)).size,
    tasks: new Set(sorted.map((session) => session.taskId)).size,
    trackedSeconds: sorted.reduce((sum, session) => sum + sessionSeconds(session, nowMs), 0),
  };
}

/** "Timi 2026-10-16.xlsx", or "Timi 2026-10-12 to 2026-10-18.xlsx" for a range (9c). */
export function exportFileName(fromDay: string, toDay: string): string {
  return fromDay === toDay ? `Timi ${fromDay}.xlsx` : `Timi ${fromDay} to ${toDay}.xlsx`;
}
