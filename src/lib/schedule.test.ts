import { describe, expect, it } from "vitest";
import {
  blockSpan,
  planHint,
  plannedRange,
  resizedLength,
  shortTime,
  snapMinutes,
  startAt,
  timeOnDay,
  workWindow,
} from "./schedule";

const at = (d: number, h: number, min = 0): number => new Date(2026, 9, d, h, min).getTime();
const window = workWindow("2026-10-17");

describe("workWindow", () => {
  it("is 7 pm to 4 am", () => {
    expect(window).toEqual({ startMs: at(17, 19), endMs: at(18, 4) });
  });
});

describe("snapping and placing", () => {
  it("snaps to 15 minutes", () => {
    expect(snapMinutes(7)).toBe(0);
    expect(snapMinutes(8)).toBe(15);
    expect(snapMinutes(52)).toBe(45);
  });

  it("places a start inside the window so the block still fits", () => {
    expect(startAt(window, 62, 60)).toBe(at(17, 20));
    expect(startAt(window, -30, 60)).toBe(at(17, 19));
    expect(startAt(window, 530, 60)).toBe(at(18, 3));
  });

  it("cuts blocks to the window", () => {
    expect(blockSpan(window, at(17, 18, 30), 60)).toEqual({ top: 0, length: 30 });
    expect(blockSpan(window, at(18, 3, 30), 60)).toEqual({ top: 510, length: 30 });
    expect(blockSpan(window, at(17, 12), 60)).toBeNull();
  });

  it("resizes in snapped steps, at least 15 minutes, up to the end", () => {
    expect(resizedLength(window, at(17, 20), 52)).toBe(45);
    expect(resizedLength(window, at(17, 20), 4)).toBe(15);
    expect(resizedLength(window, at(18, 3), 120)).toBe(60);
  });
});

describe("timeOnDay", () => {
  it("puts times after midnight on the next date of the work day", () => {
    expect(timeOnDay("2026-10-17", { hours: 23, minutes: 0 })).toBe(at(17, 23));
    expect(timeOnDay("2026-10-17", { hours: 1, minutes: 30 })).toBe(at(18, 1, 30));
  });
});

describe("labels", () => {
  it("writes short times and ranges", () => {
    expect(shortTime(at(17, 23))).toBe("11 pm");
    expect(shortTime(at(18, 0, 30))).toBe("12:30 am");
    expect(plannedRange(at(17, 23), 90)).toBe("11 pm–12:30 am");
  });
});

describe("planHint", () => {
  const task = { plannedStart: new Date(at(17, 23)).toISOString(), plannedMinutes: 90, completedAt: null };

  it("shows the plan while it is ahead", () => {
    expect(planHint(task, null, at(17, 20))).toEqual({ kind: "planned", text: "planned 11 pm–12:30 am" });
  });

  it("keeps showing it while the task is under way", () => {
    expect(planHint(task, at(17, 22, 50), at(17, 23, 30))?.kind).toBe("planned");
  });

  it("says not started once its time passes without a session", () => {
    expect(planHint(task, null, at(17, 23, 5))).toEqual({ kind: "late", text: "not started · 11 pm" });
    // A session from much earlier doesn't count
    expect(planHint(task, at(17, 19), at(17, 23, 5))?.kind).toBe("late");
  });

  it("is quiet after a started block ends, for done tasks and without a plan", () => {
    expect(planHint(task, at(17, 23), at(18, 1))).toBeNull();
    expect(planHint({ ...task, completedAt: "x" }, null, at(17, 20))).toBeNull();
    expect(planHint({ ...task, plannedStart: null }, null, at(17, 20))).toBeNull();
  });
});
