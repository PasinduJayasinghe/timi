const LOCALE = "en-GB";

function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((p) => p.type === type)?.value ?? "";
}

/** Title bar date in local time, e.g. "Friday, 10 October". */
export function formatTitleDate(date: Date): string {
  const parts = new Intl.DateTimeFormat(LOCALE, {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).formatToParts(date);
  return `${part(parts, "weekday")}, ${part(parts, "day")} ${part(parts, "month")}`;
}

/** A day in full, e.g. "Friday 10 October" (headings and labels). */
export function formatLongDate(key: string): string {
  return new Intl.DateTimeFormat(LOCALE, { weekday: "long", day: "numeric", month: "long" }).format(
    fromLocalDayKey(key),
  );
}

/** A day's weekday, e.g. "Friday" (a shift keeps its evening's name after midnight). */
export function formatWeekday(key: string): string {
  return new Intl.DateTimeFormat(LOCALE, { weekday: "long" }).format(fromLocalDayKey(key));
}

/** Log day picker date in local time, e.g. "Fri 10 Oct". */
export function formatShortDate(date: Date): string {
  const parts = new Intl.DateTimeFormat(LOCALE, {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).formatToParts(date);
  return `${part(parts, "weekday")} ${part(parts, "day")} ${part(parts, "month")}`;
}

/**
 * A work day starts at 6 am, so a night shift (7 pm – 4 am) counts as one day: in the Today list,
 * the Log, the timeline, totals and carry-over. Day keys ("YYYY-MM-DD") name the date it starts on.
 */
const DAY_START_HOUR = 6;

/** Local calendar date as "YYYY-MM-DD". */
export function toLocalDayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Local midnight at the start of a "YYYY-MM-DD" day. */
export function fromLocalDayKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/** The day `count` calendar days after `key` (negative for earlier days). */
export function addDays(key: string, count: number): string {
  const date = fromLocalDayKey(key);
  return toLocalDayKey(new Date(date.getFullYear(), date.getMonth(), date.getDate() + count));
}

/** Local time when a work day starts: 6 am on its date. */
export function dayStartOf(key: string): Date {
  const date = fromLocalDayKey(key);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), DAY_START_HOUR);
}

/** The work day a moment belongs to: before 6 am counts as the previous date. */
export function workDayKey(date: Date): string {
  if (date.getHours() >= DAY_START_HOUR) return toLocalDayKey(date);
  return toLocalDayKey(new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1));
}

/** A work day as UTC ISO bounds [start, end). Days with a clock change are 23 or 25 hours long. */
export function workDayRange(key: string): { start: string; end: string } {
  return {
    start: dayStartOf(key).toISOString(),
    end: dayStartOf(addDays(key, 1)).toISOString(),
  };
}

/** How far back a day is, as in the 2a Recent list: "today", "yesterday", "Wed", or "3 Oct" for older days. */
export function relativeDayLabel(key: string, todayKey: string): string {
  if (key === todayKey) return "today";
  if (key === addDays(todayKey, -1)) return "yesterday";
  const date = fromLocalDayKey(key);
  if (key > addDays(todayKey, -7) && key < todayKey) {
    return new Intl.DateTimeFormat(LOCALE, { weekday: "short" }).format(date);
  }
  const parts = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short" }).formatToParts(date);
  return `${part(parts, "day")} ${part(parts, "month")}`;
}

/** Milliseconds from `now` until the next work day starts (the next 6 am). */
export function msUntilNextDayStart(now: Date): number {
  return dayStartOf(addDays(workDayKey(now), 1)).getTime() - now.getTime();
}
