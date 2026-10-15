import { useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { setMeetingPrefs, type MeetingPrefs } from "../data/calendar";
import type { Settings } from "../data/settings";
import type { SettingsState } from "./useSettings";
import type { Workday } from "./useWorkday";

type MeetingTimerRequest = { eventId: string; title: string; endMs: number };

type MeetingsOptions = {
  work: Workday;
  settings: Settings | null;
  updateSetting: SettingsState["update"];
};

/**
 * Meeting timers from the alarm window (4b). Rust schedules the alarms and tells this window to
 * start a timer (`meeting-start-timer`) or stop it when the event ends (`meeting-ended`), because
 * the main window owns the database. Meeting preferences live in Settings and are mirrored in Rust.
 */
export function useMeetings(options: MeetingsOptions): void {
  const latest = useRef(options);
  latest.current = options;
  const { settings } = options;

  // Rust needs the lead time, chime and auto-start to schedule and show alarms
  const leadMinutes = settings?.meetingAlertMinutes;
  const chime = settings?.meetingChime;
  const autoStart = settings?.autoStartMeetingTimer;
  useEffect(() => {
    if (leadMinutes === undefined || chime === undefined || autoStart === undefined) return;
    setMeetingPrefs({ leadMinutes, chime, autoStart }).catch((error: unknown) => {
      console.error("[meetings] prefs failed", error);
    });
  }, [leadMinutes, chime, autoStart]);

  useEffect(() => {
    const unlisteners = [
      listen<MeetingTimerRequest>("meeting-start-timer", ({ payload }) => {
        const { work } = latest.current;
        // Joining the same meeting again carries on with its task
        const existing = work.list.tasks.find((task) => task.calendarEventId === payload.eventId);
        if (existing) work.startTask(existing.id);
        else work.startNew({ title: payload.title, type: "meeting", calendarEventId: payload.eventId });
      }),
      listen<string>("meeting-ended", ({ payload }) => {
        const { work } = latest.current;
        // Only if the meeting's timer is still the one running
        if (work.timer.running?.calendarEventId === payload) work.timer.pause();
      }),
      listen<MeetingPrefs>("meeting-prefs-changed", ({ payload }) => {
        const { settings: current, updateSetting } = latest.current;
        if (!current) return;
        if (payload.leadMinutes !== current.meetingAlertMinutes)
          updateSetting("meetingAlertMinutes", payload.leadMinutes);
        if (payload.chime !== current.meetingChime) updateSetting("meetingChime", payload.chime);
        if (payload.autoStart !== current.autoStartMeetingTimer)
          updateSetting("autoStartMeetingTimer", payload.autoStart);
      }),
    ];
    return () => {
      for (const unlisten of unlisteners) {
        void unlisten.then((stop) => {
          stop();
        });
      }
    };
  }, []);
}
