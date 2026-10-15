import { describe, expect, it } from "vitest";
import {
  addDays,
  formatShortDate,
  formatTitleDate,
  msUntilNextDayStart,
  relativeDayLabel,
  toLocalDayKey,
  workDayKey,
  workDayRange,
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

describe("workDayKey", () => {
  it("starts the work day at 6 am", () => {
    expect(workDayKey(new Date(2026, 9, 10, 6, 0))).toBe("2026-10-10");
    expect(workDayKey(new Date(2026, 9, 10, 5, 59, 59))).toBe("2026-10-09");
  });

  it("keeps a night shift on the date it started", () => {
    expect(workDayKey(new Date(2026, 9, 10, 19, 0))).toBe("2026-10-10");
    expect(workDayKey(new Date(2026, 9, 11, 0, 45))).toBe("2026-10-10");
    expect(workDayKey(new Date(2026, 9, 11, 3, 5))).toBe("2026-10-10");
  });

  it("crosses month ends and clock changes", () => {
    expect(workDayKey(new Date(2026, 10, 1, 2, 0))).toBe("2026-10-31");
    // 01:30 on the night clocks go back happens twice; both belong to the 24th
    expect(workDayKey(new Date(2026, 9, 25, 1, 30))).toBe("2026-10-24");
    expect(workDayKey(new Date(2026, 2, 29, 3, 0))).toBe("2026-03-28");
  });
});

describe("msUntilNextDayStart", () => {
  const HOUR = 3_600_000;

  it("counts to the next 6 am", () => {
    expect(msUntilNextDayStart(new Date(2026, 9, 11, 7, 0))).toBe(23 * HOUR);
    expect(msUntilNextDayStart(new Date(2026, 9, 11, 1, 30))).toBe(4.5 * HOUR);
  });

  it("is 23 hours across the night clocks go forward", () => {
    expect(msUntilNextDayStart(new Date(2026, 2, 28, 6, 0))).toBe(23 * HOUR);
  });

  it("is 25 hours across the night clocks go back", () => {
    expect(msUntilNextDayStart(new Date(2026, 9, 24, 6, 0))).toBe(25 * HOUR);
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

describe("workDayRange", () => {
  const hours = (range: { start: string; end: string }): number =>
    (Date.parse(range.end) - Date.parse(range.start)) / 3_600_000;

  it("runs from 6 am to 6 am the next day", () => {
    // British Summer Time is UTC+1
    expect(workDayRange("2026-10-10")).toEqual({
      start: "2026-10-10T05:00:00.000Z",
      end: "2026-10-11T05:00:00.000Z",
    });
  });

  it("is 23 or 25 hours long when the clocks change overnight", () => {
    expect(hours(workDayRange("2026-03-28"))).toBe(23);
    expect(hours(workDayRange("2026-10-24"))).toBe(25);
    expect(hours(workDayRange("2026-10-25"))).toBe(24);
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
