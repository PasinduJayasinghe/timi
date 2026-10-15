import { invoke } from "@tauri-apps/api/core";

/**
 * Google Calendar (read-only), owned by Rust: src-tauri/src/calendar. Tokens never reach the
 * web view; it reads status and cached events through these commands.
 */

export type CalendarInfo = {
  id: string;
  name: string;
  /** Google's calendar colour, e.g. "#F27FA5". */
  color: string;
  primary: boolean;
  included: boolean;
};

export type Attendee = { name: string; isSelf: boolean };

export type CalendarEvent = {
  id: string;
  calendarId: string;
  title: string;
  /** Milliseconds since the Unix epoch. */
  startMs: number;
  endMs: number;
  /** A Google Meet link, if the event has one. */
  meetUrl: string | null;
  location: string | null;
  attendees: Attendee[];
};

/** Why the last sync failed (3c). */
export type SyncProblem = "network" | "auth";

export type CalendarStatus = {
  /** False when this build has no Google OAuth client (.env). */
  configured: boolean;
  connected: boolean;
  email: string | null;
  syncedAtMs: number | null;
  problem: SyncProblem | null;
  calendars: CalendarInfo[];
  syncing: boolean;
};

/** Why Connect didn't finish. */
export type ConnectError = "not-configured" | "cancelled" | "network";

export function calendarStatus(): Promise<CalendarStatus> {
  return invoke<CalendarStatus>("calendar_status");
}

/** Opens the browser to sign in with Google, then syncs. Rejects with a ConnectError. */
export function connectCalendar(): Promise<CalendarStatus> {
  return invoke<CalendarStatus>("calendar_connect");
}

export function disconnectCalendar(): Promise<CalendarStatus> {
  return invoke<CalendarStatus>("calendar_disconnect");
}

/** `force` skips the one-minute gap between syncs (Retry). */
export function syncCalendar(force: boolean): Promise<void> {
  return invoke("calendar_sync", { force });
}

/** Events of included calendars overlapping [startMs, endMs). */
export function calendarEvents(startMs: number, endMs: number): Promise<CalendarEvent[]> {
  return invoke<CalendarEvent[]>("calendar_events", { startMs, endMs });
}

export function setIncludedCalendars(ids: string[]): Promise<CalendarStatus> {
  return invoke<CalendarStatus>("calendar_set_included", { ids });
}

/** Opens a Google Meet link in the browser; Rust refuses anything else. */
export function openMeet(url: string): Promise<void> {
  return invoke("open_meet", { url });
}

export function isConnectError(value: unknown): value is ConnectError {
  return value === "not-configured" || value === "cancelled" || value === "network";
}
