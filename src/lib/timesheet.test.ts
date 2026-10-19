import { describe, expect, it } from "vitest";
import type { Session } from "../data/types";
import { buildTimesheet } from "./timesheet";

// Local times (vitest runs in Europe/London)
const at = (hours: number, minutes: number): string => new Date(2026, 9, 10, hours, minutes).toISOString();

const base: Omit<Session, "id" | "startedAt" | "endedAt"> = {
  taskId: "t1",
  dayKey: "2026-10-10",
  lastSeenAt: null,
  taskTitle: "Checkout flow — fix payment step",
  taskType: "client",
  ticketNumber: null,
  clientName: "Client A",
  projectName: "Storefront",
  calendarEventId: null,
};

describe("buildTimesheet", () => {
  it("writes the 3f columns as tab-separated text", () => {
    const text = buildTimesheet(
      [
        { ...base, id: "s1", startedAt: at(20, 0), endedAt: at(21, 15) },
        {
          ...base,
          id: "s2",
          taskType: "support",
          taskTitle: "Login loop on Safari",
          ticketNumber: "4821",
          clientName: "Client C",
          projectName: null,
          startedAt: at(22, 0),
          endedAt: at(22, 50),
        },
        {
          ...base,
          id: "s3",
          taskType: "other",
          taskTitle: "Inbox & admin",
          clientName: null,
          projectName: null,
          startedAt: at(22, 50),
          endedAt: at(23, 10),
        },
      ],
      Date.now(),
    );

    expect(text.split("\n")).toEqual([
      "Task\tType\tClient/Project\tStart\tEnd\tDuration",
      "Checkout flow — fix payment step\tClient\tClient A · Storefront\t8:00 pm\t9:15 pm\t1h 15m",
      "#4821 Login loop on Safari\tSupport\tClient C\t10:00 pm\t10:50 pm\t50m",
      "Inbox & admin\tOther\t—\t10:50 pm\t11:10 pm\t20m",
    ]);
  });

  it("ends a running session at now", () => {
    const now = Date.parse(at(23, 42));
    const text = buildTimesheet([{ ...base, id: "s1", startedAt: at(23, 18), endedAt: null }], now);
    expect(text.split("\n")[1]).toBe(
      "Checkout flow — fix payment step\tClient\tClient A · Storefront\t11:18 pm\tnow\t24m",
    );
  });

  it("keeps tabs and line breaks in titles from splitting cells", () => {
    const text = buildTimesheet(
      [{ ...base, id: "s1", taskTitle: "A\tB\nC", startedAt: at(9, 0), endedAt: at(9, 30) }],
      0,
    );
    expect(text.split("\n")[1].split("\t")[0]).toBe("A B C");
  });
});
