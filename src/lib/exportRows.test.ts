import { describe, expect, it } from "vitest";
import type { Session, Task } from "../data/types";
import { buildExport, exportFileName, localIso } from "./exportRows";

const at = (d: number, h: number, min = 0): string => new Date(2026, 9, d, h, min).toISOString();

function task(id: string, fields: Partial<Task> = {}): Task {
  return {
    id,
    title: "Login loop on Safari",
    type: "support",
    clientId: null,
    clientName: "Client C",
    projectId: null,
    projectName: null,
    ticketNumber: "4821",
    notes: "",
    estimateMinutes: 90,
    listDay: "2026-10-13",
    carriedFrom: "2026-10-12",
    position: 1,
    remindAt: null,
    calendarEventId: null,
    plannedStart: null,
    plannedMinutes: null,
    completedAt: at(13, 20),
    createdAt: at(12, 19),
    updatedAt: at(13, 20),
    ...fields,
  };
}

function session(id: string, taskId: string, dayKey: string, start: string, end: string | null): Session {
  return {
    id,
    taskId,
    dayKey,
    startedAt: start,
    endedAt: end,
    lastSeenAt: null,
    taskTitle: "Login loop on Safari",
    taskType: "support",
    ticketNumber: "4821",
    clientName: "Client C",
    projectName: null,
    calendarEventId: null,
  };
}

describe("buildExport", () => {
  const tasks = [
    task("t1"),
    task("t2", {
      title: "Draft release notes",
      type: "internal",
      ticketNumber: null,
      clientName: null,
      projectName: "SLE Hub",
      estimateMinutes: 60,
      listDay: "2026-10-14",
      carriedFrom: null,
      completedAt: null,
    }),
  ];
  const sessions = [
    session("s1", "t1", "2026-10-12", at(12, 21, 32), at(12, 23, 5)),
    session("s2", "t1", "2026-10-13", at(13, 19, 5), at(13, 19, 55)),
  ];
  const data = buildExport(tasks, sessions, Date.parse(at(14, 12)));

  it("has one task row per task per day, done on its last day", () => {
    expect(data.tasks).toEqual([
      {
        day: "2026-10-12",
        title: "#4821 Login loop on Safari",
        typeLabel: "Support ticket",
        whereLabel: "Client C",
        estimateMinutes: 90,
        trackedSeconds: 93 * 60,
        done: false,
      },
      {
        day: "2026-10-13",
        title: "#4821 Login loop on Safari",
        typeLabel: "Support ticket",
        whereLabel: "Client C",
        estimateMinutes: 90,
        trackedSeconds: 50 * 60,
        done: true,
      },
      {
        day: "2026-10-14",
        title: "Draft release notes",
        typeLabel: "Internal project",
        whereLabel: "SLE Hub",
        estimateMinutes: 60,
        trackedSeconds: 0,
        done: false,
      },
    ]);
  });

  it("has a row per session in local time, and the summary", () => {
    expect(data.sessions[0]).toMatchObject({
      day: "2026-10-12",
      start: "2026-10-12T21:32:00",
      end: "2026-10-12T23:05:00",
    });
    expect(data.days).toBe(2);
    expect(data.trackedSeconds).toBe(143 * 60);
  });

  it("counts a running session up to now", () => {
    const now = Date.parse(at(14, 20, 30));
    const running = buildExport([], [session("s3", "t9", "2026-10-14", at(14, 20), null)], now);
    expect(running.sessions[0].seconds).toBe(30 * 60);
    expect(running.sessions[0].end).toBe(localIso(now));
    expect(running.tasks).toHaveLength(1);
  });
});

describe("exportFileName", () => {
  it("names a day or a range", () => {
    expect(exportFileName("2026-10-16", "2026-10-16")).toBe("Timi 2026-10-16.xlsx");
    expect(exportFileName("2026-10-12", "2026-10-18")).toBe("Timi 2026-10-12 to 2026-10-18.xlsx");
  });
});
