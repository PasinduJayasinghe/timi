import { describe, expect, it } from "vitest";
import type { Session } from "../data/types";
import type { TaskType } from "./taskTypes";
import { buildExport, exportFileName, localIso } from "./exportRows";

const at = (d: number, h: number, min = 0): string => new Date(2026, 9, d, h, min).toISOString();

function session(
  id: string,
  taskId: string,
  dayKey: string,
  start: string,
  end: string | null,
  fields: Partial<Session> & { taskType?: TaskType } = {},
): Session {
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
    ...fields,
  };
}

describe("buildExport", () => {
  const sessions = [
    // Out of order on purpose: rows come out oldest first
    session("s2", "t2", "2026-10-12", at(12, 23, 30), at(13, 0, 15), {
      taskTitle: "Draft release notes",
      taskType: "internal",
      ticketNumber: null,
      clientName: "Client A",
      projectName: "SLE Hub",
    }),
    session("s1", "t1", "2026-10-12", at(12, 21, 32), at(12, 23, 5)),
  ];
  const notes = new Map([["t2", "Changelog first\n\n  then screenshots  "]]);
  const data = buildExport(sessions, notes, Date.parse(at(14, 12)));

  it("has one row per session in the template's columns", () => {
    expect(data.rows).toEqual([
      {
        date: "2026-10-12",
        start: "2026-10-12T21:32:00",
        finish: "2026-10-12T23:05:00",
        kindOfWork: "Support",
        clients: "Client C",
        project: "",
        workedOn: "#4821 Login loop on Safari",
        note: "",
      },
      {
        // A night shift keeps its date after midnight
        date: "2026-10-12",
        start: "2026-10-12T23:30:00",
        finish: "2026-10-13T00:15:00",
        kindOfWork: "Internal",
        // Internal work has no client, even if one was left on the task
        clients: "",
        project: "SLE Hub",
        workedOn: "Draft release notes",
        note: "Changelog first; then screenshots",
      },
    ]);
  });

  it("summarises the range", () => {
    expect(data.days).toBe(1);
    expect(data.tasks).toBe(2);
    expect(data.trackedSeconds).toBe((93 + 45) * 60);
  });

  it("finishes a running session now", () => {
    const now = Date.parse(at(14, 20, 30));
    const running = buildExport([session("s3", "t9", "2026-10-14", at(14, 20), null)], new Map(), now);
    expect(running.rows[0].finish).toBe(localIso(now));
    expect(running.trackedSeconds).toBe(30 * 60);
  });
});

describe("exportFileName", () => {
  it("names a day or a range", () => {
    expect(exportFileName("2026-10-16", "2026-10-16")).toBe("Timi 2026-10-16.xlsx");
    expect(exportFileName("2026-10-12", "2026-10-18")).toBe("Timi 2026-10-12 to 2026-10-18.xlsx");
  });
});
