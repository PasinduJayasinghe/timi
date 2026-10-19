import { describe, expect, it } from "vitest";
import type { Session } from "../data/types";
import { isStale, secondsByTask, sessionSeconds, totalSeconds, totalsBySummary } from "./sessionMath";
import type { TaskType } from "./taskTypes";

const T0 = Date.parse("2026-10-10T09:00:00.000Z");
const iso = (minutes: number): string => new Date(T0 + minutes * 60_000).toISOString();

function session(taskId: string, type: TaskType, start: number, end: number | null): Session {
  return {
    id: `${taskId}-${start}`,
    taskId,
    dayKey: "2026-10-10",
    startedAt: iso(start),
    endedAt: end === null ? null : iso(end),
    lastSeenAt: null,
    taskTitle: "Task",
    taskType: type,
    ticketNumber: null,
    clientName: null,
    projectName: null,
    calendarEventId: null,
  };
}

describe("sessionSeconds", () => {
  it("uses the stored end time", () => {
    expect(sessionSeconds(session("a", "client", 0, 75), T0 + 999 * 60_000)).toBe(75 * 60);
  });

  it("counts a running session up to now", () => {
    expect(sessionSeconds(session("a", "client", 10, null), T0 + 34 * 60_000)).toBe(24 * 60);
  });

  it("never goes negative when the clock is behind the start", () => {
    expect(sessionSeconds(session("a", "client", 10, null), T0)).toBe(0);
  });
});

describe("totals", () => {
  const now = T0 + 300 * 60_000;
  const sessions = [
    session("a", "client", 0, 60),
    session("b", "internal", 60, 100),
    session("a", "client", 100, 115),
    session("c", "meeting", 120, 150),
    session("d", "support", 280, null),
  ];

  it("adds up every session", () => {
    expect(totalSeconds(sessions, now)).toBe((60 + 40 + 15 + 30 + 20) * 60);
  });

  it("adds up per task", () => {
    const byTask = secondsByTask(sessions, now);
    expect(byTask.get("a")).toBe(75 * 60);
    expect(byTask.get("b")).toBe(40 * 60);
    expect(byTask.get("d")).toBe(20 * 60);
  });

  it("groups meeting timers under Meetings", () => {
    expect(totalsBySummary(sessions, now)).toEqual({
      client: 75 * 60,
      internal: 40 * 60,
      support: 20 * 60,
      meetings: 30 * 60,
      other: 0,
    });
  });
});

describe("isStale", () => {
  it("allows gaps up to five minutes", () => {
    expect(isStale(iso(0), T0 + 5 * 60_000)).toBe(false);
  });

  it("flags longer gaps (crash, shutdown or sleep)", () => {
    expect(isStale(iso(0), T0 + 5 * 60_000 + 1)).toBe(true);
    expect(isStale(iso(0), T0 + 8 * 3_600_000)).toBe(true);
  });
});
