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
 * The axis for a work day: the working hours, widened to whole hours to include every session and
 * the `extra` spans. Extra spans are kept inside 6 am to 6 am; sessions belong to the day's shift,
 * so they always fit, even past 6 am.
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
  for (const span of extra) {
    startMs = Math.min(startMs, floorHour(span.startMs));
    endMs = Math.max(endMs, ceilHour(span.endMs));
  }
  startMs = Math.max(startMs, dayStartOf(dayKey).getTime());
  endMs = Math.min(endMs, dayStartOf(addDays(dayKey, 1)).getTime());
  // The day's sessions always fit: a shift can run past 6 am (Phase 7)
  for (const session of sessions) {
    const sessionStart = Date.parse(session.startedAt);
    const sessionEnd = session.endedAt ? Date.parse(session.endedAt) : Math.max(nowMs, sessionStart + MIN_RUNNING_MS);
    startMs = Math.min(startMs, floorHour(sessionStart));
    endMs = Math.max(endMs, ceilHour(sessionEnd));
  }
  return { startMs, endMs };
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

/** The end label is left out when the last hour label is closer than this (they'd overlap). */
const END_LABEL_GAP_PERCENT = 15;

/** "19:00", "01:00" (24-hour, Phase 12). */
const hourText = (hour: number): string => `${String(hour).padStart(2, "0")}:00`;

/**
 * Axis labels (24-hour).
 * - expanded (1a): every 3 hours ("19:00 22:00 01:00") plus the end at the right ("04:00") when
 *   there's room for it, since the longer labels would otherwise overlap in the narrow panel.
 * - wide (1d): every hour.
 */
export function axisLabels(axis: TimelineAxis, variant: "expanded" | "wide"): AxisLabel[] {
  const hours = axisHours(axis);
  if (variant === "wide") {
    return hours.map(({ hour, percent }) => ({ text: hourText(hour), percent, align: "start" }));
  }
  const labels: AxisLabel[] = hours
    .filter((_, index) => index % 3 === 0)
    .map(({ hour, percent }, index) => ({ text: hourText(hour), percent, align: index === 0 ? "start" : "center" }));
  const last = labels[labels.length - 1];
  if (!last || 100 - last.percent >= END_LABEL_GAP_PERCENT) {
    labels.push({ text: hourText(new Date(axis.endMs).getHours()), percent: 100, align: "end" });
  }
  return labels;
}

/** Which timeline row a session goes in. */
export function rowOf(session: Session): SummaryKey {
  return summaryKey(session.taskType);
}
