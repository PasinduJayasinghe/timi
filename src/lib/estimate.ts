const MAX_MINUTES = 99 * 60;

/**
 * Parses an estimate typed by the user: "45m", "45", "2h", "1h 30m", "1.5h".
 * A bare number means minutes. Returns null for an empty value (no estimate)
 * and undefined when the text can't be read.
 */
export function parseEstimate(text: string): number | null | undefined {
  const value = text.trim().toLowerCase();
  if (value === "") return null;

  const match = /^(?:(\d+(?:\.\d+)?)\s*h)?\s*(?:(\d+)\s*m?)?$/.exec(value);
  if (!match || (match[1] === undefined && match[2] === undefined)) return undefined;

  const minutes = Math.round(Number(match[1] ?? 0) * 60) + Number(match[2] ?? 0);
  if (minutes <= 0 || minutes > MAX_MINUTES) return undefined;
  return minutes;
}

/** Formats minutes the way the design does: "45m", "2h", "1h 30m". */
export function formatMinutes(minutes: number): string {
  const total = Math.round(minutes);
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}
