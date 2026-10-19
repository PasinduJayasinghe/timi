import { describe, expect, it } from "vitest";
import { carriedLabel, dayLoad, isOverPlanned, weekCellLabel } from "./plan";

const at = (d: number, h: number, min = 0): number => new Date(2026, 9, d, h, min).getTime();

describe("dayLoad", () => {
  it("counts meetings inside the working hours only", () => {
    const meetings = [
      { startMs: at(17, 22, 15), endMs: at(17, 22, 30) },
      { startMs: at(18, 0, 30), endMs: at(18, 1, 0) },
      // Before the working hours start
      { startMs: at(17, 15), endMs: at(17, 16) },
    ];
    expect(dayLoad("2026-10-17", 360, meetings)).toEqual({
      plannedMinutes: 360,
      meetingMinutes: 45,
      freeMinutes: 135,
      overMinutes: 0,
      spanMinutes: 540,
    });
  });

  it("reports how far over a day is planned", () => {
    const load = dayLoad("2026-10-17", 9 * 60, [{ startMs: at(17, 20), endMs: at(17, 21) }]);
    expect(load.freeMinutes).toBe(0);
    expect(load.overMinutes).toBe(60);
  });

  it("is the whole day for a day already past", () => {
    expect(dayLoad("2026-10-01", 120, []).freeMinutes).toBe(420);
  });
});

describe("weekCellLabel", () => {
  it("shows tasks and estimated hours", () => {
    expect(weekCellLabel(5, 360)).toBe("5·6h");
    expect(weekCellLabel(2, 90)).toBe("2·1.5h");
    expect(weekCellLabel(1, 45)).toBe("1·45m");
  });

  it("shows only the count without estimates, and a dash for an empty day", () => {
    expect(weekCellLabel(3, 0)).toBe("3");
    expect(weekCellLabel(0, 0)).toBe("—");
  });

  it("marks days planned beyond the 9 working hours", () => {
    expect(isOverPlanned(540)).toBe(false);
    expect(isOverPlanned(541)).toBe(true);
  });
});

describe("carriedLabel", () => {
  it("names the day a task came from", () => {
    expect(carriedLabel("2026-10-16", "2026-10-17")).toBe("from yesterday");
    expect(carriedLabel("2026-10-14", "2026-10-17")).toBe("from Wed");
    expect(carriedLabel("2026-10-02", "2026-10-17")).toBe("from 2 Oct");
  });
});
