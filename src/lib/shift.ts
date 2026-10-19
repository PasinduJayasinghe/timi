import { addDays, dayStartOf, fromLocalDayKey, workDayKey } from "./date";
import { WORK_SPAN_MIN, WORK_START_MIN } from "./timeline";

/** A work day from Start shift to End shift (Phase 7). */
export type Shift = {
  id: string;
  /** The day it belongs to, "YYYY-MM-DD": the work day it started on. */
  dayKey: string;
  /** UTC ISO timestamps. An open shift has no `endedAt`. */
  startedAt: string;
  endedAt: string | null;
  /** "auto" when Timi ended a shift that was left open (7l). */
  endedBy: "user" | "auto" | null;
  /** When the "ended for you" note was dismissed. */
  noticedAt: string | null;
};

/** A shift left open ends on its own once nothing has been timed for this long (7l). */
export const AUTO_END_IDLE_MS = 4 * 60 * 60 * 1000;

/**
 * The day a new shift starts on: the work day now (days start at 6 am), or the day after the last
 * shift when that day is already taken, e.g. starting again at 5 am after ending at 4 am.
 */
export function nextShiftDay(now: Date, lastDayKey: string | null): string {
  const key = workDayKey(now);
  return lastDayKey !== null && key <= lastDayKey ? addDays(lastDayKey, 1) : key;
}

/**
 * When a shift that was left open should end, or null to keep it open. It ends only after the
 * 6 am line following its day, with no timer running and nothing timed for AUTO_END_IDLE_MS; it
 * ends at the last thing timed (or when it started, if nothing was).
 */
export function autoEndAt(
  shift: Pick<Shift, "dayKey" | "startedAt">,
  lastActivityMs: number | null,
  nowMs: number,
  timerRunning: boolean,
): string | null {
  if (timerRunning) return null;
  if (nowMs < dayStartOf(addDays(shift.dayKey, 1)).getTime()) return null;
  const last = Math.max(Date.parse(shift.startedAt), lastActivityMs ?? 0);
  if (nowMs - last < AUTO_END_IDLE_MS) return null;
  return new Date(last).toISOString();
}

/**
 * Minutes left for tasks on a day (Plan my day step 2): its working hours (7 pm for 9 hours, as on
 * the timeline) from now on, less the meetings in them. Overlapping meetings count once.
 */
export function minutesLeftForTasks(
  dayKey: string,
  nowMs: number,
  meetings: readonly { startMs: number; endMs: number }[],
): number {
  const date = fromLocalDayKey(dayKey);
  const startMs = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, WORK_START_MIN).getTime();
  const endMs = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    0,
    WORK_START_MIN + WORK_SPAN_MIN,
  ).getTime();
  const from = Math.max(nowMs, startMs);
  if (from >= endMs) return 0;
  let busy = 0;
  let cursor = from;
  for (const meeting of [...meetings].sort((a, b) => a.startMs - b.startMs)) {
    const meetingStart = Math.max(meeting.startMs, cursor);
    const meetingEnd = Math.min(meeting.endMs, endMs);
    if (meetingEnd > meetingStart) {
      busy += meetingEnd - meetingStart;
      cursor = meetingEnd;
    }
  }
  return Math.round((endMs - from - busy) / 60_000);
}
