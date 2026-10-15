import { describe, expect, it } from "vitest";
import { formatShortDate, formatTitleDate, msUntilNextLocalMidnight, toLocalDayKey } from "./date";

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
