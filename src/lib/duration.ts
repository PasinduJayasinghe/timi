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

function clockParts(iso: string): { time: string; suffix: "am" | "pm" } {
  const date = new Date(iso);
  const hours = date.getHours();
  return {
    time: `${hours % 12 || 12}:${pad(date.getMinutes())}`,
    suffix: hours >= 12 ? "pm" : "am",
  };
}

/** Local time of day, as in the Log (3g): "7:02 pm". */
export function formatTimeOfDay(iso: string): string {
  const { time, suffix } = clockParts(iso);
  return `${time} ${suffix}`;
}

/** Start and end in the narrow Log (3f): "8:00p – 9:15p", or "11:18p – now" while running. */
export function formatTimeRange(startIso: string, endIso: string | null): string {
  const short = (iso: string): string => {
    const { time, suffix } = clockParts(iso);
    return `${time}${suffix[0]}`;
  };
  return `${short(startIso)} – ${endIso ? short(endIso) : "now"}`;
}
