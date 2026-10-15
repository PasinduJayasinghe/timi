import { describe, expect, it } from "vitest";
import { nextOccurrence, parseTimeOfDay, reminderLength } from "./reminder";

describe("parseTimeOfDay", () => {
  it.each([
    ["4:30 pm", 16, 30],
    ["4:30pm", 16, 30],
    ["4:30p", 16, 30],
    ["4:30 PM", 16, 30],
    ["4pm", 16, 0],
    ["4 pm", 16, 0],
    ["4:30 p.m.", 16, 30],
    ["12:15 am", 0, 15],
    ["12 pm", 12, 0],
    ["11:55 pm", 23, 55],
    ["16:30", 16, 30],
    ["0930", 9, 30],
    ["9", 9, 0],
    [" 7:05 am ", 7, 5],
  ])("reads %s", (text, hours, minutes) => {
    expect(parseTimeOfDay(text)).toEqual({ hours, minutes });
  });

  it.each(["", "abc", "25:00", "4:60", "13 pm", "0 am", "4:3", "4:30 xm", "half four"])("rejects %s", (text) => {
    expect(parseTimeOfDay(text)).toBeUndefined();
  });
});

describe("nextOccurrence", () => {
  const now = new Date(2026, 9, 10, 23, 40);

  it("uses today when the time is still ahead", () => {
    expect(nextOccurrence({ hours: 23, minutes: 55 }, now)).toEqual(new Date(2026, 9, 10, 23, 55));
  });

  it("moves to tomorrow once the time has passed, e.g. after midnight in a night shift", () => {
    expect(nextOccurrence({ hours: 0, minutes: 15 }, now)).toEqual(new Date(2026, 9, 11, 0, 15));
    expect(nextOccurrence({ hours: 23, minutes: 40 }, now)).toEqual(new Date(2026, 9, 11, 23, 40));
  });

  it("crosses month ends", () => {
    expect(nextOccurrence({ hours: 1, minutes: 0 }, new Date(2026, 9, 31, 22, 0))).toEqual(new Date(2026, 10, 1, 1, 0));
  });
});

describe("reminderLength", () => {
  it.each([
    [15, "15 min"],
    [30, "30 min"],
    [60, "1 hour"],
    [120, "2 hours"],
  ])("labels %i minutes as %s", (minutes, label) => {
    expect(reminderLength(minutes)).toBe(label);
  });
});
