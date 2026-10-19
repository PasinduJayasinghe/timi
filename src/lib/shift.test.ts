import { describe, expect, it } from "vitest";
import { AUTO_END_IDLE_MS, autoEndAt, minutesLeftForTasks, nextShiftDay } from "./shift";

const local = (y: number, m: number, d: number, h: number, min = 0): Date => new Date(y, m - 1, d, h, min);

describe("nextShiftDay", () => {
  it("is the work day now when there is no earlier shift", () => {
    expect(nextShiftDay(local(2026, 10, 16, 19), null)).toBe("2026-10-16");
    // Before 6 am counts as the previous date
    expect(nextShiftDay(local(2026, 10, 17, 3), null)).toBe("2026-10-16");
  });

  it("is the work day now when the last shift was on an earlier day", () => {
    expect(nextShiftDay(local(2026, 10, 17, 19), "2026-10-16")).toBe("2026-10-17");
  });

  it("moves to the next day when the last shift took today", () => {
    // Ended Friday's night shift at 4 am, starting again at 5 am
    expect(nextShiftDay(local(2026, 10, 17, 5), "2026-10-16")).toBe("2026-10-17");
    // A day shift ended at 5 pm, starting again the same evening
    expect(nextShiftDay(local(2026, 10, 16, 20), "2026-10-16")).toBe("2026-10-17");
  });
});

describe("autoEndAt", () => {
  const shift = {
    dayKey: "2026-10-16",
    startedAt: local(2026, 10, 16, 19, 2).toISOString(),
  };
  const lastTimed = local(2026, 10, 17, 4, 2).getTime();

  it("keeps a shift open before the 6 am line after its day", () => {
    expect(autoEndAt(shift, lastTimed, local(2026, 10, 17, 5, 59).getTime(), false)).toBeNull();
  });

  it("keeps a shift open while a timer runs", () => {
    expect(autoEndAt(shift, lastTimed, local(2026, 10, 17, 19).getTime(), true)).toBeNull();
  });

  it("keeps a shift open until nothing has been timed for 4 hours", () => {
    const working = local(2026, 10, 17, 7).getTime();
    expect(autoEndAt(shift, working, working + AUTO_END_IDLE_MS - 1, false)).toBeNull();
  });

  it("ends a forgotten shift at the last thing timed", () => {
    expect(autoEndAt(shift, lastTimed, local(2026, 10, 17, 19).getTime(), false)).toBe(
      new Date(lastTimed).toISOString(),
    );
  });

  it("ends a shift with nothing timed at its start", () => {
    expect(autoEndAt(shift, null, local(2026, 10, 17, 19).getTime(), false)).toBe(shift.startedAt);
  });
});

describe("minutesLeftForTasks", () => {
  const meeting = (h1: number, m1: number, h2: number, m2: number, day = 16) => ({
    startMs: local(2026, 10, day, h1, m1).getTime(),
    endMs: local(2026, 10, day, h2, m2).getTime(),
  });

  it("is the whole working window before it starts", () => {
    expect(minutesLeftForTasks("2026-10-16", local(2026, 10, 16, 15).getTime(), [])).toBe(9 * 60);
  });

  it("counts from now and leaves out meetings", () => {
    const now = local(2026, 10, 16, 20).getTime();
    expect(minutesLeftForTasks("2026-10-16", now, [meeting(22, 15, 22, 30)])).toBe(8 * 60 - 15);
  });

  it("counts overlapping meetings once and ignores time outside the window", () => {
    const now = local(2026, 10, 16, 19).getTime();
    const meetings = [meeting(21, 0, 22, 0), meeting(21, 30, 22, 30), meeting(16, 0, 17, 0), meeting(3, 30, 5, 0, 17)];
    expect(minutesLeftForTasks("2026-10-16", now, meetings)).toBe(9 * 60 - 90 - 30);
  });

  it("is zero after the working hours", () => {
    expect(minutesLeftForTasks("2026-10-16", local(2026, 10, 17, 5).getTime(), [])).toBe(0);
  });
});
