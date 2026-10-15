import type { Session } from "../data/types";
import { formatDuration, formatTimeOfDay } from "./duration";
import { sessionSeconds } from "./sessionMath";
import { displayTitle, sessionDisplay, whereLabel } from "./taskDisplay";
import { TYPE_STYLES } from "./taskTypes";

const HEADER = ["Task", "Type", "Client/Project", "Start", "End", "Duration"];

/** Tabs and line breaks would split a cell, so they become spaces. */
function cell(value: string): string {
  return value.replace(/[\t\r\n]+/g, " ");
}

/**
 * The Log as tab-separated text for pasting into a timesheet (3f "Copy for timesheet").
 * A running session ends "now" and counts up to `nowMs`.
 */
export function buildTimesheet(sessions: readonly Session[], nowMs: number): string {
  const rows = sessions.map((session) => {
    const task = sessionDisplay(session);
    return [
      displayTitle(task),
      TYPE_STYLES[task.type].short,
      whereLabel(task) ?? "—",
      formatTimeOfDay(session.startedAt),
      session.endedAt ? formatTimeOfDay(session.endedAt) : "now",
      formatDuration(sessionSeconds(session, nowMs)),
    ];
  });
  return [HEADER, ...rows].map((row) => row.map(cell).join("\t")).join("\n");
}
