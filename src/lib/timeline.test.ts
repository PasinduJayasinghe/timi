import { describe, expect, it } from "vitest";
import type { Session } from "../data/types";
import { axisLabels, axisPercent, barPosition, rangePosition, rowOf, timelineAxis } from "./timeline";
import type { TaskType } from "./taskTypes";

// Local times (vitest runs in Europe/London)
const at = (day: number, hours: number, minutes = 0): number => new Date(2026, 9, day, hours, minutes).getTime();
const iso = (ms: number): string => new Date(ms).toISOString();

function session(start: number, end: number | null, type: TaskType = "client"): Session {
  return {
    id: `s-${start}`,
    taskId: "t1",
    startedAt: iso(start),
    endedAt: end === null ? null : iso(end),
    lastSeenAt: null,
    taskTitle: "Task",
    taskType: type,
    ticketNumber: null,
    clientName: null,
    projectName: null,
  };
}

describe("timelineAxis", () => {
  it("covers the working hours, 7 pm to 4 am", () => {
    expect(timelineAxis("2026-10-10", [], at(10, 12))).toEqual({ startMs: at(10, 19), endMs: at(11, 4) });
  });

  it("widens to whole hours around sessions outside the working hours", () => {
    const axis = timelineAxis(
      "2026-10-10",
      [session(at(10, 17, 40), at(10, 18, 10)), session(at(11, 4, 5), at(11, 4, 30))],
      0,
    );
    expect(axis).toEqual({ startMs: at(10, 17), endMs: at(11, 5) });
  });

  it("widens for a running session up to now", () => {
    expect(timelineAxis("2026-10-10", [session(at(11, 3, 30), null)], at(11, 4, 20)).endMs).toBe(at(11, 5));
  });

  it("widens for calendar events too", () => {
    const axis = timelineAxis("2026-10-10", [], 0, [{ startMs: at(11, 4, 30), endMs: at(11, 5, 15) }]);
    expect(axis).toEqual({ startMs: at(10, 19), endMs: at(11, 6) });
  });

  it("stays inside the work day (6 am to 6 am)", () => {
    const axis = timelineAxis("2026-10-10", [session(at(10, 6, 15), at(10, 7)), session(at(11, 5, 30), at(11, 7))], 0);
    expect(axis).toEqual({ startMs: at(10, 6), endMs: at(11, 6) });
  });
});

describe("barPosition", () => {
  const axis = { startMs: at(10, 19), endMs: at(11, 4) };

  it("places a session as a share of the 9-hour axis", () => {
    // 8:00 pm to 9:15 pm, as in 1f
    const bar = barPosition(session(at(10, 20), at(10, 21, 15)), axis, 0);
    expect(bar.left).toBeCloseTo(11.11, 2);
    expect(bar.width).toBeCloseTo(13.89, 2);
  });

  it("grows a running session up to now, at least one minute wide", () => {
    expect(barPosition(session(at(10, 23), null), axis, at(10, 23, 54)).width).toBeCloseTo(10, 5);
    expect(barPosition(session(at(10, 23), null), axis, at(10, 23)).width).toBeCloseTo((1 / 540) * 100, 5);
  });

  it("clips at the ends of the axis", () => {
    const bar = barPosition(session(at(11, 3, 30), at(11, 5)), axis, 0);
    expect(bar.left + bar.width).toBeCloseTo(100, 5);
  });
});

describe("rangePosition", () => {
  it("places and clips a time range", () => {
    const axis = { startMs: at(10, 19), endMs: at(11, 4) };
    const event = rangePosition(at(11, 0, 30), at(11, 1, 15), axis);
    expect(event.left).toBeCloseTo((330 / 540) * 100, 5);
    expect(event.width).toBeCloseTo((45 / 540) * 100, 5);
    expect(rangePosition(at(10, 18), at(10, 19, 30), axis)).toEqual({ left: 0, width: (30 / 540) * 100 });
  });
});

describe("axisPercent", () => {
  const axis = { startMs: at(10, 19), endMs: at(11, 4) };

  it("finds now on the axis, or null outside it", () => {
    expect(axisPercent(at(10, 23, 30), axis)).toBeCloseTo(50, 5);
    expect(axisPercent(at(10, 12), axis)).toBeNull();
  });
});

describe("axisLabels", () => {
  const axis = { startMs: at(10, 19), endMs: at(11, 4) };

  it("labels every 2 hours and the end in the expanded panel (1a)", () => {
    expect(axisLabels(axis, "expanded").map((label) => label.text)).toEqual(["7p", "9p", "11p", "1a", "3a", "4a"]);
    const labels = axisLabels(axis, "expanded");
    expect(labels[0].align).toBe("start");
    expect(labels[1].percent).toBeCloseTo(22.22, 2);
    expect(labels[labels.length - 1]).toEqual({ text: "4a", percent: 100, align: "end" });
  });

  it("labels every hour in the wide strip (1d)", () => {
    expect(axisLabels(axis, "wide").map((label) => label.text)).toEqual([
      "7 pm",
      "8",
      "9",
      "10",
      "11",
      "12 am",
      "1",
      "2",
      "3",
    ]);
  });

  it("keeps hourly steps on the night the clocks go back", () => {
    // 1 am happens twice on 25 October, so the 7 pm – 4 am axis has 10 hours
    const longNight = { startMs: at(24, 19), endMs: at(25, 4) };
    expect(axisLabels(longNight, "wide").map((label) => label.text)).toEqual([
      "7 pm",
      "8",
      "9",
      "10",
      "11",
      "12 am",
      "1",
      "1",
      "2",
      "3",
    ]);
  });
});

describe("rowOf", () => {
  it("puts meeting timers in the Meetings row", () => {
    expect(rowOf(session(0, 1, "meeting"))).toBe("meetings");
    expect(rowOf(session(0, 1, "support"))).toBe("support");
  });
});
