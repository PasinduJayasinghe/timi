import { describe, expect, it } from "vitest";
import { isSyncError, syncStatus, syncTooltip, toUploadRow } from "./cloudSync";

describe("toUploadRow", () => {
  it("sends the session's stored work day: the shift it was timed in", () => {
    const base = {
      id: "s1",
      taskId: "t1",
      taskTitle: "Checkout flow",
      taskType: "client",
      clientName: "Client A",
      projectName: "Storefront",
      ticketNumber: null,
      calendarEventId: null,
      dayKey: "2026-10-10",
      endedAt: "2026-10-11T08:00:00.000Z",
    };
    // 7 am on the 11th still belongs to the 10th while that shift is open
    expect(toUploadRow({ ...base, startedAt: new Date(2026, 9, 11, 7, 0).toISOString() }).workDay).toBe("2026-10-10");
    expect(toUploadRow({ ...base, startedAt: "2026-10-10T19:00:00.000Z" }).taskTitle).toBe("Checkout flow");
  });
});

describe("syncStatus", () => {
  const base = { configured: true, uploading: false, error: null, pending: 0 };

  it("hides the chip without a Supabase project", () => {
    expect(syncStatus({ ...base, configured: false, pending: 3 })).toBe("off");
  });

  it("is saved when nothing waits, even after an old error", () => {
    expect(syncStatus(base)).toBe("saved");
    expect(syncStatus({ ...base, error: "network" })).toBe("saved");
  });

  it("is syncing while uploading or about to", () => {
    expect(syncStatus({ ...base, uploading: true, pending: 2 })).toBe("syncing");
    expect(syncStatus({ ...base, pending: 2 })).toBe("syncing");
  });

  it("is offline when sessions wait after a failed upload", () => {
    expect(syncStatus({ ...base, error: "network", pending: 2 })).toBe("offline");
    expect(syncStatus({ ...base, error: "signed-out", pending: 1 })).toBe("offline");
  });
});

describe("syncTooltip", () => {
  it("matches the 2e wording", () => {
    expect(syncTooltip("saved", null, 0)).toBe("All sessions saved and synced");
    expect(syncTooltip("syncing", null, 1)).toBe("Syncing 1 session…");
    expect(syncTooltip("offline", "network", 2)).toBe("Saved on this device, will sync later · 2 sessions waiting");
  });

  it("explains why sync can't sign in", () => {
    expect(syncTooltip("offline", "signed-out", 2)).toContain("connect Google Calendar");
    expect(syncTooltip("offline", "auth", 2)).toContain("sign in to Google Calendar again");
  });
});

describe("isSyncError", () => {
  it("accepts only the known errors", () => {
    expect(isSyncError("network")).toBe(true);
    expect(isSyncError("boom")).toBe(false);
    expect(isSyncError(undefined)).toBe(false);
  });
});
