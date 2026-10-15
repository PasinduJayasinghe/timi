import { Switch } from "../../components/Switch";
import { MEETING_LEADS } from "../../data/calendar";
import type { Settings } from "../../data/settings";

type MeetingSettingsProps = {
  settings: Settings;
  onChange: <K extends keyof Settings>(name: K, value: Settings[K]) => void;
};

/** Settings > Meetings (4e): alert lead time and alarm sound. */
export function MeetingSettings({ settings, onChange }: MeetingSettingsProps) {
  return (
    <section aria-labelledby="settings-meetings" className="flex flex-col gap-1.5">
      <h2 id="settings-meetings" className="m-0 px-1 text-label tracking-[0.07em] text-ink-muted uppercase">
        Meetings
      </h2>
      <div className="flex flex-col rounded-lg border border-white/90 bg-white/60">
        <div className="flex min-h-13 items-center gap-2.5 border-b border-ink-muted/8 px-3 py-1.5">
          <span id="settings-alert-before" className="flex-1 text-ui font-medium">
            Alert before meeting
          </span>
          <div
            role="radiogroup"
            aria-labelledby="settings-alert-before"
            className="flex rounded-sm bg-ink-muted/8 p-0.5"
          >
            {MEETING_LEADS.map((minutes) => {
              const active = settings.meetingAlertMinutes === minutes;
              return (
                <button
                  key={minutes}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={`${minutes} minute${minutes === 1 ? "" : "s"}`}
                  onClick={() => {
                    onChange("meetingAlertMinutes", minutes);
                  }}
                  className={`h-8 min-w-9 rounded-[8px] font-mono text-meta font-medium ${
                    active ? "bg-white text-ink shadow-sm" : "text-ink-muted hover:text-ink"
                  }`}
                >
                  {minutes}m
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex min-h-13 items-center gap-2.5 px-3 py-1.5">
          <div className="flex-1 leading-[1.3]">
            <div className="text-ui font-medium">Alarm sound</div>
            <div className="text-meta text-ink-muted">Gentle chime</div>
          </div>
          <Switch
            checked={settings.meetingChime}
            label="Alarm sound"
            onChange={(next) => {
              onChange("meetingChime", next);
            }}
          />
        </div>
      </div>
    </section>
  );
}
