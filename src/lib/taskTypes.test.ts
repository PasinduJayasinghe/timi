import { describe, expect, it } from "vitest";
import { CALENDAR_MEETING_STYLE, styleOf, TYPE_STYLES } from "./taskTypes";

describe("styleOf", () => {
  it("uses the task type's style", () => {
    expect(styleOf({ type: "support" })).toBe(TYPE_STYLES.support);
    expect(styleOf({ type: "meeting", calendarEventId: null })).toBe(TYPE_STYLES.meeting);
  });

  it("shows meeting timers from calendar events in the calendar style (rose, videocam)", () => {
    const style = styleOf({ type: "meeting", calendarEventId: "primary:abc" });
    expect(style).toBe(CALENDAR_MEETING_STYLE);
    expect(style.icon).toBe("videocam");
    expect(style.short).toBe("Meeting");
  });
});
