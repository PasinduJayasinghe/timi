import type { CalendarEvent } from "../data/calendar";

const MINUTE_MS = 60_000;
const pad = (value: number): string => String(value).padStart(2, "0");

function clock(ms: number): { time: string; suffix: "am" | "pm" } {
  const date = new Date(ms);
  const hours = date.getHours();
  return { time: `${hours % 12 || 12}:${pad(date.getMinutes())}`, suffix: hours >= 12 ? "pm" : "am" };
}

/**
 * An event's times (3a): "12:30–1:15 am", or "11:30 pm–12:15 am" across noon or midnight.
 * `withSuffix: false` gives the compact "2:00–2:30" of smaller cards.
 */
export function formatSpan(startMs: number, endMs: number, withSuffix = true): string {
  const start = clock(startMs);
  const end = clock(endMs);
  if (!withSuffix) return `${start.time}–${end.time}`;
  if (start.suffix === end.suffix) return `${start.time}–${end.time} ${end.suffix}`;
  return `${start.time} ${start.suffix}–${end.time} ${end.suffix}`;
}

/** Hour on a time axis (3a, 3b, 1d): "10p", "1a". */
export function hourLabel(ms: number): string {
  const hours = new Date(ms).getHours();
  return `${hours % 12 || 12}${hours < 12 ? "a" : "p"}`;
}

/** A time without am/pm (3a now line "11:42", 1d "2:00"). */
export function shortTime(ms: number): string {
  const date = new Date(ms);
  return `${date.getHours() % 12 || 12}:${pad(date.getMinutes())}`;
}

/** "in 48m", "in 1h 5m", "now" while it runs, or null once it has ended. */
export function startsIn(event: Pick<CalendarEvent, "startMs" | "endMs">, nowMs: number): string | null {
  if (event.endMs <= nowMs) return null;
  if (event.startMs <= nowMs) return "now";
  const minutes = Math.ceil((event.startMs - nowMs) / MINUTE_MS);
  if (minutes < 60) return `in ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `in ${hours}h` : `in ${hours}h ${rest}m`;
}

/** Avatar initials (3a): "Asha K" → "AK", "mr" → "MR". */
export function initials(name: string): string {
  const words = name
    .trim()
    .split(/[\s._-]+/)
    .filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/** The meeting running now, or else the next one to start. */
export function nextMeeting<T extends Pick<CalendarEvent, "startMs" | "endMs">>(
  events: readonly T[],
  nowMs: number,
): T | null {
  const upcoming = events.filter((event) => event.endMs > nowMs).sort((a, b) => a.startMs - b.startMs);
  return upcoming[0] ?? null;
}

/**
 * A day's total in the narrow week columns (3b): hours and tenths of an hour, "6h2" for 6h 12m,
 * minutes under an hour ("45m"), and "—" for nothing.
 */
export function formatWeekTotal(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes === 0) return "—";
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h${Math.floor((minutes % 60) / 6)}`;
}

/** Time left before a meeting (4a "IN 4:58"): "m:ss", or "h:mm:ss" from an hour; 0:00 once started. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

/** How far through the alert lead time we are (4a progress bar), from 0 to 1. */
export function alarmProgress(startMs: number, leadMinutes: number, nowMs: number): number {
  const lead = leadMinutes * MINUTE_MS;
  if (lead <= 0) return 1;
  return Math.min(1, Math.max(0, (nowMs - (startMs - lead)) / lead));
}

/** The Monday of the week a day key falls in ("YYYY-MM-DD"). */
export function weekStartKey(dayKey: string): string {
  const [year, month, day] = dayKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const offset = (date.getDay() + 6) % 7;
  const monday = new Date(year, month - 1, day - offset);
  return `${monday.getFullYear()}-${pad(monday.getMonth() + 1)}-${pad(monday.getDate())}`;
}
