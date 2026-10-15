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

/** Log day picker date in local time, e.g. "Fri 10 Oct". */
export function formatShortDate(date: Date): string {
  const parts = new Intl.DateTimeFormat(LOCALE, {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).formatToParts(date);
  return `${part(parts, "weekday")} ${part(parts, "day")} ${part(parts, "month")}`;
}

/** Local calendar date as "YYYY-MM-DD", used as a task's list day. */
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

/** A local day as UTC ISO bounds [start, end). Days with a clock change are 23 or 25 hours long. */
export function localDayRange(key: string): { start: string; end: string } {
  return {
    start: fromLocalDayKey(key).toISOString(),
    end: fromLocalDayKey(addDays(key, 1)).toISOString(),
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

/** True when both dates fall on the same local calendar day. */
export function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Milliseconds from `now` until the next local midnight. */
export function msUntilNextLocalMidnight(now: Date): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next.getTime() - now.getTime();
}
