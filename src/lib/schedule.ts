import { addDays, dayStartOf, fromLocalDayKey } from "./date";
import { WORK_SPAN_MIN, WORK_START_MIN } from "./timeline";

/** Planned blocks snap to this many minutes (7b). */
export const SNAP_MIN = 15;
/** The shortest planned block. */
export const MIN_BLOCK_MIN = 15;
/** A new block's length when the task has no estimate. */
export const DEFAULT_BLOCK_MIN = 60;
/** Length choices in the Schedule popover (7b). */
export const LENGTHS_MIN = [30, 60, 90, 120] as const;

const MINUTE = 60_000;

export type TimeWindow = { startMs: number; endMs: number };

/** A day's working hours: 7 pm for 9 hours, as on the timeline. */
export function workWindow(dayKey: string): TimeWindow {
  const date = fromLocalDayKey(dayKey);
  const at = (minutes: number): number =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, minutes).getTime();
  return { startMs: at(WORK_START_MIN), endMs: at(WORK_START_MIN + WORK_SPAN_MIN) };
}

/** Rounds to the nearest SNAP_MIN minutes. */
export function snapMinutes(minutes: number): number {
  return Math.round(minutes / SNAP_MIN) * SNAP_MIN;
}

/** The snapped start time for a point `offsetMinutes` into the window, kept so `length` still fits. */
export function startAt(window: TimeWindow, offsetMinutes: number, length: number): number {
  const span = (window.endMs - window.startMs) / MINUTE;
  const offset = Math.min(Math.max(snapMinutes(offsetMinutes), 0), Math.max(0, span - length));
  return window.startMs + offset * MINUTE;
}

/** A block's place in the window, in minutes from its start; parts outside the window are cut off. */
export function blockSpan(
  window: TimeWindow,
  startMs: number,
  minutes: number,
): { top: number; length: number } | null {
  const from = Math.max(startMs, window.startMs);
  const to = Math.min(startMs + minutes * MINUTE, window.endMs);
  if (to <= from) return null;
  return { top: (from - window.startMs) / MINUTE, length: (to - from) / MINUTE };
}

/** A resized length: snapped, at least MIN_BLOCK_MIN, and not past the window's end. */
export function resizedLength(window: TimeWindow, startMs: number, minutes: number): number {
  const most = Math.max(MIN_BLOCK_MIN, (window.endMs - startMs) / MINUTE);
  return Math.min(Math.max(snapMinutes(minutes), MIN_BLOCK_MIN), most);
}

/**
 * A typed time of day on a work day (6 am to 6 am): "1:00 am" on the 17th's work day is the 18th
 * at 1 am.
 */
export function timeOnDay(dayKey: string, time: { hours: number; minutes: number }): number {
  const date = fromLocalDayKey(dayKey);
  const sameDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), time.hours, time.minutes);
  if (sameDate.getTime() >= dayStartOf(dayKey).getTime()) return sameDate.getTime();
  const next = fromLocalDayKey(addDays(dayKey, 1));
  return new Date(next.getFullYear(), next.getMonth(), next.getDate(), time.hours, time.minutes).getTime();
}

/** Short clock time: "11 pm", "12:30 am". */
export function shortTime(ms: number): string {
  const date = new Date(ms);
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const hour = hours % 12 || 12;
  const suffix = hours >= 12 ? "pm" : "am";
  return minutes === 0 ? `${hour} ${suffix}` : `${hour}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

/** "11 pm–12:30 am". */
export function plannedRange(startMs: number, minutes: number): string {
  return `${shortTime(startMs)}–${shortTime(startMs + minutes * MINUTE)}`;
}

/** The hint on a task row (7c): planned (ahead or under way) or not started though its time passed. */
export type PlanHint = { kind: "planned"; text: string } | { kind: "late"; text: string };

/** Starting a little early still counts as starting the planned block. */
const EARLY_START_MS = 30 * MINUTE;

export function planHint(
  task: { plannedStart: string | null; plannedMinutes: number | null; completedAt: string | null },
  /** The latest session start for the task, if any. */
  lastStartMs: number | null,
  nowMs: number,
): PlanHint | null {
  if (!task.plannedStart || !task.plannedMinutes || task.completedAt) return null;
  const start = Date.parse(task.plannedStart);
  const end = start + task.plannedMinutes * MINUTE;
  const started = lastStartMs !== null && lastStartMs >= start - EARLY_START_MS;
  if (nowMs < start || (started && nowMs < end)) {
    return { kind: "planned", text: `planned ${plannedRange(start, task.plannedMinutes)}` };
  }
  if (!started) return { kind: "late", text: `not started · ${shortTime(start)}` };
  return null;
}
