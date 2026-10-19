import { formatShortDate, toLocalDayKey } from "./date";
import { formatTimeOfDay } from "./duration";

export type Note = {
  id: string;
  /** Plain text; the first line is the title. */
  body: string;
  pinned: boolean;
  /** UTC ISO timestamps. */
  createdAt: string;
  updatedAt: string;
};

/** The first non-empty line, or "Untitled note". */
export function noteTitle(body: string): string {
  const line = body.split("\n").find((text) => text.trim() !== "");
  return line ? line.trim() : "Untitled note";
}

/** Everything after the title, on one line (the card's two-line preview, 8a). */
export function notePreview(body: string): string {
  const lines = body.split("\n");
  const titleIndex = lines.findIndex((text) => text.trim() !== "");
  return lines
    .slice(titleIndex + 1)
    .map((text) => text.trim())
    .filter((text) => text !== "")
    .join(" ");
}

/** Whether a note matches a search, ignoring case. An empty search matches everything. */
export function matchesSearch(note: Pick<Note, "body">, query: string): boolean {
  const value = query.trim().toLowerCase();
  return value === "" || note.body.toLowerCase().includes(value);
}

/** Pinned notes first, then the rest; newest edit first in each group (8a). */
export function sortNotes<T extends Pick<Note, "pinned" | "updatedAt">>(notes: readonly T[]): T[] {
  return [...notes].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

/** "edited 2:14 am" today, "edited Thu 10:40 pm" this week, "edited 12 Oct" before. */
export function editedLabel(updatedAt: string, nowMs: number): string {
  const date = new Date(updatedAt);
  const ageDays = (nowMs - date.getTime()) / 86_400_000;
  if (toLocalDayKey(date) === toLocalDayKey(new Date(nowMs))) return `edited ${formatTimeOfDay(updatedAt)}`;
  if (ageDays < 6) {
    const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "short" }).format(date);
    return `edited ${weekday} ${formatTimeOfDay(updatedAt)}`;
  }
  return `edited ${formatShortDate(date).split(" ").slice(1).join(" ")}`;
}
