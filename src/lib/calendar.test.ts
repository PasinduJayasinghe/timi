import { describe, expect, it } from "vitest";
import {
  formatSpan,
  formatWeekTotal,
  hourLabel,
  initials,
  nextMeeting,
  shortTime,
  startsIn,
  weekStartKey,
} from "./calendar";

// Local times (vitest runs in Europe/London)
const at = (day: number, hours: number, minutes = 0): number => new Date(2026, 9, day, hours, minutes).getTime();

describe("formatSpan", () => {
  it("writes am/pm once when both ends share it (3a)", () => {
    expect(formatSpan(at(11, 0, 30), at(11, 1, 15))).toBe("12:30–1:15 am");
  });

  it("writes both when the meeting crosses midnight or noon", () => {
    expect(formatSpan(at(10, 23, 30), at(11, 0, 15))).toBe("11:30 pm–12:15 am");
    expect(formatSpan(at(10, 11, 45), at(10, 12, 30))).toBe("11:45 am–12:30 pm");
  });

  it("has a compact form for small cards", () => {
    expect(formatSpan(at(11, 2), at(11, 2, 30), false)).toBe("2:00–2:30");
  });
});

describe("hourLabel and shortTime", () => {
  it("labels hours and times without am/pm", () => {
    expect(hourLabel(at(10, 22))).toBe("10p");
    expect(hourLabel(at(11, 0))).toBe("12a");
    expect(hourLabel(at(11, 1))).toBe("1a");
    expect(shortTime(at(10, 23, 42))).toBe("11:42");
    expect(shortTime(at(11, 2, 5))).toBe("2:05");
  });
});

describe("startsIn", () => {
  const meeting = { startMs: at(11, 0, 30), endMs: at(11, 1, 15) };

  it("counts down to the start", () => {
    expect(startsIn(meeting, at(10, 23, 42))).toBe("in 48m");
    expect(startsIn(meeting, at(10, 23, 25))).toBe("in 1h 5m");
    expect(startsIn(meeting, at(10, 23, 30))).toBe("in 1h");
  });

  it("says now while it runs, and nothing after", () => {
    expect(startsIn(meeting, at(11, 0, 40))).toBe("now");
    expect(startsIn(meeting, at(11, 1, 15))).toBeNull();
  });
});

describe("initials", () => {
  it.each([
    ["Asha K", "AK"],
    ["Mia Rose Lane", "ML"],
    ["mr", "MR"],
    ["j.lee", "JL"],
    ["  ", "?"],
  ])("%s → %s", (name, expected) => {
    expect(initials(name)).toBe(expected);
  });
});

describe("nextMeeting", () => {
  const events = [
    { id: "late", startMs: at(11, 2), endMs: at(11, 2, 30) },
    { id: "done", startMs: at(10, 21), endMs: at(10, 21, 30) },
    { id: "soon", startMs: at(11, 0, 30), endMs: at(11, 1, 15) },
  ];

  it("picks the earliest meeting that hasn't ended", () => {
    expect(nextMeeting(events, at(10, 23, 42))?.id).toBe("soon");
    expect(nextMeeting(events, at(11, 1))?.id).toBe("soon");
    expect(nextMeeting(events, at(11, 1, 20))?.id).toBe("late");
    expect(nextMeeting(events, at(11, 3))).toBeNull();
  });
});

describe("formatWeekTotal", () => {
  it.each([
    [0, "—"],
    [45 * 60, "45m"],
    [6 * 3600 + 12 * 60, "6h2"],
    [7 * 3600 + 5 * 60, "7h0"],
    [4 * 3600 + 59 * 60, "4h9"],
  ])("%i seconds → %s", (seconds, text) => {
    expect(formatWeekTotal(seconds)).toBe(text);
  });
});

describe("weekStartKey", () => {
  it("finds the Monday", () => {
    expect(weekStartKey("2026-10-10")).toBe("2026-10-05");
    expect(weekStartKey("2026-10-05")).toBe("2026-10-05");
    expect(weekStartKey("2026-10-11")).toBe("2026-10-05");
    expect(weekStartKey("2026-11-01")).toBe("2026-10-26");
  });
});
