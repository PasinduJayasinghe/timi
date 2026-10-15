/** Quick reminder times in the picker and the Default reminder setting, in minutes. */
export const QUICK_REMINDERS = [15, 30, 60, 120] as const;

/** "15 min", "30 min", "1 hour", "2 hours" (4e "Default reminder"). */
export function reminderLength(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  return hours === 1 ? "1 hour" : `${hours} hours`;
}

/**
 * Reads a typed time of day: "4:30 pm", "4:30pm", "4:30p", "4pm", "4 pm", "16:30" or "9".
 * Returns hours (0–23) and minutes, or undefined when the text isn't a time.
 */
export function parseTimeOfDay(text: string): { hours: number; minutes: number } | undefined {
  const match = /^(\d{1,2})(?::?(\d{2}))?\s*(a|am|p|pm)?$/i.exec(text.trim().replace(/\./g, ""));
  if (!match) return undefined;
  let hours = Number(match[1]);
  const minutes = match[2] === undefined ? 0 : Number(match[2]);
  const suffix = match[3]?.toLowerCase();
  if (minutes > 59) return undefined;
  if (suffix) {
    if (hours < 1 || hours > 12) return undefined;
    hours = (hours % 12) + (suffix.startsWith("p") ? 12 : 0);
  } else if (hours > 23) {
    return undefined;
  }
  return { hours, minutes };
}

/** The next time that time of day comes round after `now`: today, or tomorrow if it has passed. */
export function nextOccurrence(time: { hours: number; minutes: number }, now: Date): Date {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), time.hours, time.minutes);
  if (today.getTime() > now.getTime()) return today;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, time.hours, time.minutes);
}
