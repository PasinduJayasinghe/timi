import { describe, expect, it } from "vitest";
import {
  addDays,
  formatShortDate,
  formatTitleDate,
  localDayRange,
  msUntilNextLocalMidnight,
  relativeDayLabel,
  toLocalDayKey,
} from "./date";

// vitest.config.ts runs these tests in Europe/London, which has daylight saving.

describe("toLocalDayKey", () => {
  it("pads month and day", () => {
    expect(toLocalDayKey(new Date(2026, 0, 5, 12))).toBe("2026-01-05");
  });

  it("uses the local date just before and after midnight", () => {
    expect(toLocalDayKey(new Date(2026, 9, 10, 23, 59, 59))).toBe("2026-10-10");
    expect(toLocalDayKey(new Date(2026, 9, 11, 0, 0, 1))).toBe("2026-10-11");
  });

  it("is not shifted by UTC on daylight-saving days", () => {
    // 00:30 local on the day clocks go forward is still 23:30 UTC the previous day
    expect(toLocalDayKey(new Date(2026, 2, 29, 0, 30))).toBe("2026-03-29");
    expect(toLocalDayKey(new Date(2026, 9, 25, 0, 30))).toBe("2026-10-25");
  });
});

describe("msUntilNextLocalMidnight", () => {
  const HOUR = 3_600_000;

  it("is 23 hours on the day clocks go forward", () => {
    expect(msUntilNextLocalMidnight(new Date(2026, 2, 29, 0, 0))).toBe(23 * HOUR);
  });

  it("is 25 hours on the day clocks go back", () => {
    expect(msUntilNextLocalMidnight(new Date(2026, 9, 25, 0, 0))).toBe(25 * HOUR);
  });
});

describe("date labels", () => {
  it("formats the title bar date with a comma", () => {
    expect(formatTitleDate(new Date(2026, 9, 10))).toBe("Saturday, 10 October");
  });

  it("formats the short day picker date", () => {
    expect(formatShortDate(new Date(2026, 9, 10))).toBe("Sat 10 Oct");
  });
});

describe("addDays", () => {
  it("crosses month and year ends", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("moves one calendar day across clock changes", () => {
    expect(addDays("2026-03-28", 1)).toBe("2026-03-29");
    expect(addDays("2026-03-29", 1)).toBe("2026-03-30");
    expect(addDays("2026-10-25", -1)).toBe("2026-10-24");
  });
});

describe("localDayRange", () => {
  const hours = (range: { start: string; end: string }): number =>
    (Date.parse(range.end) - Date.parse(range.start)) / 3_600_000;

  it("starts and ends at local midnight", () => {
    // British Summer Time is UTC+1
    expect(localDayRange("2026-10-10")).toEqual({
      start: "2026-10-09T23:00:00.000Z",
      end: "2026-10-10T23:00:00.000Z",
    });
  });

  it("is 23 or 25 hours long on clock-change days", () => {
    expect(hours(localDayRange("2026-03-29"))).toBe(23);
    expect(hours(localDayRange("2026-10-25"))).toBe(25);
    expect(hours(localDayRange("2026-10-26"))).toBe(24);
  });
});

describe("relativeDayLabel", () => {
  const today = "2026-10-15"; // a Thursday

  it.each([
    ["2026-10-15", "today"],
    ["2026-10-14", "yesterday"],
    ["2026-10-12", "Mon"],
    ["2026-10-09", "Fri"],
    ["2026-10-08", "8 Oct"],
    ["2026-09-30", "30 Sept"],
  ])("labels %s as %s", (key, label) => {
    expect(relativeDayLabel(key, today)).toBe(label);
  });
});
