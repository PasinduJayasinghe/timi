import { describe, expect, it } from "vitest";
import { formatClock, formatDuration, formatTimeOfDay, formatTimeRange } from "./duration";

describe("formatClock", () => {
  it.each([
    [0, "00:00"],
    [59.9, "00:59"],
    [24 * 60 + 13, "24:13"],
    [40 * 60, "40:00"],
    [3600, "1:00:00"],
    [3600 + 2 * 60 + 5, "1:02:05"],
    [-5, "00:00"],
  ])("formats %d seconds as %s", (seconds, text) => {
    expect(formatClock(seconds)).toBe(text);
  });
});

describe("formatDuration", () => {
  it.each([
    [0, "0m"],
    [29, "0m"],
    [30, "1m"],
    [35 * 60, "35m"],
    [60 * 60, "1h"],
    [84 * 60, "1h 24m"],
    [84 * 60 + 40, "1h 25m"],
  ])("formats %d seconds as %s", (seconds, text) => {
    expect(formatDuration(seconds)).toBe(text);
  });

  it("pads minutes for the wide Log column", () => {
    expect(formatDuration(65 * 60, { padMinutes: true })).toBe("1h 05m");
    expect(formatDuration(128 * 60, { padMinutes: true })).toBe("2h 08m");
    expect(formatDuration(15 * 60, { padMinutes: true })).toBe("15m");
    expect(formatDuration(120 * 60, { padMinutes: true })).toBe("2h");
  });
});

describe("time of day", () => {
  // Local times (vitest runs in Europe/London)
  const at = (hours: number, minutes: number): string => new Date(2026, 9, 10, hours, minutes).toISOString();

  it("formats 12-hour times as in 3g", () => {
    expect(formatTimeOfDay(at(19, 2))).toBe("7:02 pm");
    expect(formatTimeOfDay(at(0, 40))).toBe("12:40 am");
    expect(formatTimeOfDay(at(12, 5))).toBe("12:05 pm");
  });

  it("formats short ranges as in 3f", () => {
    expect(formatTimeRange(at(20, 0), at(21, 15))).toBe("8:00p – 9:15p");
    expect(formatTimeRange(at(23, 18), null)).toBe("11:18p – now");
  });
});
