import type { Session } from "../data/types";
import type { TaskType } from "./taskTypes";

/** A running session writes its "last seen" time this often. */
export const HEARTBEAT_MS = 60_000;

/** A gap longer than this (crash, shutdown or sleep) closes the session at its last seen time. */
const STALE_AFTER_MS = 5 * 60_000;

type Timed = Pick<Session, "startedAt" | "endedAt">;

/** Seconds in a session, from its timestamps. A running session counts up to `nowMs`. */
export function sessionSeconds(session: Timed, nowMs: number): number {
  const end = session.endedAt ? Date.parse(session.endedAt) : nowMs;
  return Math.max(0, (end - Date.parse(session.startedAt)) / 1000);
}

export function totalSeconds(sessions: readonly Timed[], nowMs: number): number {
  return sessions.reduce((sum, session) => sum + sessionSeconds(session, nowMs), 0);
}

export function secondsByTask(sessions: readonly Session[], nowMs: number): Map<string, number> {
  const totals = new Map<string, number>();
  for (const session of sessions) {
    totals.set(session.taskId, (totals.get(session.taskId) ?? 0) + sessionSeconds(session, nowMs));
  }
  return totals;
}

/** Log summary groups (3f): meeting timers are counted under Meetings. */
export const SUMMARY_KEYS = ["client", "internal", "support", "meetings", "other"] as const;

export type SummaryKey = (typeof SUMMARY_KEYS)[number];

/** The summary group (Log totals, timeline row) a task type counts under. */
export function summaryKey(type: TaskType): SummaryKey {
  return type === "meeting" ? "meetings" : type;
}

export function totalsBySummary(sessions: readonly Session[], nowMs: number): Record<SummaryKey, number> {
  const totals: Record<SummaryKey, number> = { client: 0, internal: 0, support: 0, meetings: 0, other: 0 };
  for (const session of sessions) {
    totals[summaryKey(session.taskType)] += sessionSeconds(session, nowMs);
  }
  return totals;
}

/** True when Timi hasn't been seen running for longer than STALE_AFTER_MS. */
export function isStale(lastSeenIso: string, nowMs: number): boolean {
  return nowMs - Date.parse(lastSeenIso) > STALE_AFTER_MS;
}
