import { formatMinutes } from "./estimate";

const pad = (value: number): string => String(value).padStart(2, "0");

/** Live timer: "24:13", or "1:02:05" past an hour (1a). */
export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(rest)}` : `${pad(minutes)}:${pad(rest)}`;
}

/**
 * Tracked time rounded to the minute: "35m", "1h", "1h 24m".
 * `padMinutes` gives the wide Log column style (3g): "1h 05m".
 */
export function formatDuration(seconds: number, options: { padMinutes?: boolean } = {}): string {
  const minutes = Math.round(Math.max(0, seconds) / 60);
  if (!options.padMinutes) return formatMinutes(minutes);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${pad(rest)}m`;
}

/** Local time of day, 24-hour (Phase 12): "19:02", "01:30". */
export function formatTimeOfDay(iso: string): string {
  const date = new Date(iso);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Start and end in the Log: "20:00 – 21:15", or "23:18 – now" while running. */
export function formatTimeRange(startIso: string, endIso: string | null): string {
  return `${formatTimeOfDay(startIso)} – ${endIso ? formatTimeOfDay(endIso) : "now"}`;
}
