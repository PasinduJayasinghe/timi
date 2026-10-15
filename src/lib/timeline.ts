import type { Session } from "../data/types";
import { addDays, dayStartOf, fromLocalDayKey } from "./date";
import { summaryKey, type SummaryKey } from "./sessionMath";

/** Working hours on the axis: 7 pm for 9 hours (1a). Settings arrive with Phase 4. */
export const WORK_START_MIN = 19 * 60;
export const WORK_SPAN_MIN = 9 * 60;

/** Timeline rows, top to bottom (1a). Meeting timers go in Meetings; calendar events join them in Phase 5. */
export const TIMELINE_ROWS: readonly SummaryKey[] = ["client", "internal", "support", "other", "meetings"];

/** A running session's bar is at least this wide, so it shows as soon as it starts. */
const MIN_RUNNING_MS = 60_000;

export type TimelineAxis = { startMs: number; endMs: number };

function floorHour(ms: number): number {
  const date = new Date(ms);
  date.setMinutes(0, 0, 0);
  return date.getTime();
}

function ceilHour(ms: number): number {
  const floor = floorHour(ms);
  if (floor === ms) return ms;
  const date = new Date(floor);
  date.setHours(date.getHours() + 1);
  return date.getTime();
}

/**
 * The axis for a work day: the working hours, widened to whole hours to include every session,
 * and kept inside the work day (6 am to 6 am).
 */
export function timelineAxis(
  dayKey: string,
  sessions: readonly Session[],
  nowMs: number,
  /** Other things to fit, e.g. calendar events. */
  extra: readonly { startMs: number; endMs: number }[] = [],
): TimelineAxis {
  const date = fromLocalDayKey(dayKey);
  const at = (minutes: number): number =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, minutes).getTime();

  let startMs = at(WORK_START_MIN);
  let endMs = at(WORK_START_MIN + WORK_SPAN_MIN);
  for (const session of sessions) {
    const sessionStart = Date.parse(session.startedAt);
    const sessionEnd = session.endedAt ? Date.parse(session.endedAt) : Math.max(nowMs, sessionStart + MIN_RUNNING_MS);
    startMs = Math.min(startMs, floorHour(sessionStart));
    endMs = Math.max(endMs, ceilHour(sessionEnd));
  }
  for (const span of extra) {
    startMs = Math.min(startMs, floorHour(span.startMs));
    endMs = Math.max(endMs, ceilHour(span.endMs));
  }
  return {
    startMs: Math.max(startMs, dayStartOf(dayKey).getTime()),
    endMs: Math.min(endMs, dayStartOf(addDays(dayKey, 1)).getTime()),
  };
}

/** Where a session sits on the axis, as percentages of its width. */
export function barPosition(
  session: Pick<Session, "startedAt" | "endedAt">,
  axis: TimelineAxis,
  nowMs: number,
): { left: number; width: number } {
  const span = axis.endMs - axis.startMs;
  const startMs = Date.parse(session.startedAt);
  const endMs = session.endedAt ? Date.parse(session.endedAt) : Math.max(nowMs, startMs + MIN_RUNNING_MS);
  const from = Math.max(startMs, axis.startMs);
  const to = Math.min(endMs, axis.endMs);
  return { left: ((from - axis.startMs) / span) * 100, width: (Math.max(0, to - from) / span) * 100 };
}

/** Where a time range (e.g. a calendar event) sits on the axis, as percentages of its width. */
export function rangePosition(startMs: number, endMs: number, axis: TimelineAxis): { left: number; width: number } {
  const span = axis.endMs - axis.startMs;
  const from = Math.max(startMs, axis.startMs);
  const to = Math.min(endMs, axis.endMs);
  return { left: ((from - axis.startMs) / span) * 100, width: (Math.max(0, to - from) / span) * 100 };
}

/** Position of a moment on the axis (percent), or null when it falls outside. */
export function axisPercent(ms: number, axis: TimelineAxis): number | null {
  if (ms < axis.startMs || ms > axis.endMs) return null;
  return ((ms - axis.startMs) / (axis.endMs - axis.startMs)) * 100;
}

export type AxisHour = { ms: number; percent: number; hour: number };

const HOUR_MS = 3_600_000;

/**
 * Every hour from the start of the axis up to (not including) its end. Steps are real hours, so
 * the night the clocks go back shows 1 am twice and the night they go forward skips it.
 */
export function axisHours(axis: TimelineAxis): AxisHour[] {
  const hours: AxisHour[] = [];
  for (let ms = axis.startMs; ms < axis.endMs; ms += HOUR_MS) {
    hours.push({
      ms,
      percent: ((ms - axis.startMs) / (axis.endMs - axis.startMs)) * 100,
      hour: new Date(ms).getHours(),
    });
  }
  return hours;
}

export type AxisLabel = { text: string; percent: number; align: "start" | "center" | "end" };

const hour12 = (hour: number): number => hour % 12 || 12;

/**
 * Axis labels.
 * - expanded (1a): every 2 hours ("7p 9p 11p 1a 3a") plus the end at the right ("4a").
 * - wide (1d): every hour ("7 pm 8 9 10 11 12 am 1 2 3"), with am/pm on the first hour and at 12.
 */
export function axisLabels(axis: TimelineAxis, variant: "expanded" | "wide"): AxisLabel[] {
  const hours = axisHours(axis);
  if (variant === "wide") {
    return hours.map(({ hour, percent }, index) => ({
      text: index === 0 || hour % 12 === 0 ? `${hour12(hour)} ${hour < 12 ? "am" : "pm"}` : String(hour12(hour)),
      percent,
      align: "start",
    }));
  }
  const short = (hour: number): string => `${hour12(hour)}${hour < 12 ? "a" : "p"}`;
  const labels: AxisLabel[] = hours
    .filter((_, index) => index % 2 === 0)
    .map(({ hour, percent }, index) => ({ text: short(hour), percent, align: index === 0 ? "start" : "center" }));
  labels.push({ text: short(new Date(axis.endMs).getHours()), percent: 100, align: "end" });
  return labels;
}

/** Which timeline row a session goes in. */
export function rowOf(session: Session): SummaryKey {
  return summaryKey(session.taskType);
}
