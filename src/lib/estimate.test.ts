import { describe, expect, it } from "vitest";
import { formatMinutes, parseEstimate } from "./estimate";

describe("parseEstimate", () => {
  it.each([
    ["45m", 45],
    ["45", 45],
    ["2h", 120],
    ["1h 30m", 90],
    ["1h30m", 90],
    ["1.5h", 90],
    [" 15 m ", 15],
    ["2H", 120],
  ])("reads %s as %i minutes", (text, minutes) => {
    expect(parseEstimate(text)).toBe(minutes);
  });

  it("treats empty text as no estimate", () => {
    expect(parseEstimate("")).toBeNull();
    expect(parseEstimate("   ")).toBeNull();
  });

  it.each(["abc", "h", "1x", "0m", "-5", "1h 30x", "100h"])("rejects %s", (text) => {
    expect(parseEstimate(text)).toBeUndefined();
  });
});

describe("formatMinutes", () => {
  it.each([
    [15, "15m"],
    [60, "1h"],
    [90, "1h 30m"],
    [120, "2h"],
  ])("formats %i as %s", (minutes, text) => {
    expect(formatMinutes(minutes)).toBe(text);
  });

  it("round-trips with parseEstimate", () => {
    for (const minutes of [5, 45, 60, 75, 120, 135]) {
      expect(parseEstimate(formatMinutes(minutes))).toBe(minutes);
    }
  });
});
