import { relativeDayLabel } from "./date";
import { minutesLeftForTasks } from "./shift";
import { WORK_SPAN_MIN } from "./timeline";

/** A day's planned work against its working hours (7a load bar). */
export type DayLoad = {
  plannedMinutes: number;
  /** Meeting time inside the working hours. */
  meetingMinutes: number;
  /** Working hours left after meetings and planned work, never below 0. */
  freeMinutes: number;
  /** Planned work beyond what meetings leave, or 0. */
  overMinutes: number;
  /** The working hours: 9h. */
  spanMinutes: number;
};

/** The whole day's load, from the start of its working hours (not from now). */
export function dayLoad(
  dayKey: string,
  plannedMinutes: number,
  meetings: readonly { startMs: number; endMs: number }[],
): DayLoad {
  const available = minutesLeftForTasks(dayKey, 0, meetings);
  return {
    plannedMinutes,
    meetingMinutes: WORK_SPAN_MIN - available,
    freeMinutes: Math.max(0, available - plannedMinutes),
    overMinutes: Math.max(0, plannedMinutes - available),
    spanMinutes: WORK_SPAN_MIN,
  };
}

/** Hours for the week strip: "6h", "1.5h", or "45m" under an hour. */
function shortHours(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round((minutes / 60) * 2) / 2;
  return `${hours}h`;
}

/** The line under a date in the Plan week strip (7a): "5·6h" (tasks · estimated hours), "3", or "—". */
export function weekCellLabel(tasks: number, estimateMinutes: number): string {
  if (tasks === 0) return "—";
  return estimateMinutes > 0 ? `${tasks}·${shortHours(estimateMinutes)}` : String(tasks);
}

/** Whether a day's estimates are more than its working hours (the week strip turns orange). */
export function isOverPlanned(estimateMinutes: number): boolean {
  return estimateMinutes > WORK_SPAN_MIN;
}

/** The tag on a carried, kept or moved task: "from yesterday", "from Fri" or "from 12 Oct". */
export function carriedLabel(carriedFrom: string, listDay: string): string {
  return `from ${relativeDayLabel(carriedFrom, listDay)}`;
}
