import { getVersion } from "@tauri-apps/api/app";
import {
  disable as disableAutostart,
  enable as enableAutostart,
  isEnabled as autostartEnabled,
} from "@tauri-apps/plugin-autostart";
import { useEffect, useState, type ReactNode } from "react";
import { Icon } from "../../components/Icon";
import { IconButton } from "../../components/IconButton";
import { Switch } from "../../components/Switch";
import { handleDragMouseDown } from "../../components/TitleBar";
import { useToast } from "../../components/Toast";
import type { Settings } from "../../data/settings";
import { quickAddShortcutRegistered } from "../../lib/desktop";
import { QUICK_REMINDERS, reminderLength } from "../../lib/reminder";
import type { CalendarState } from "../../hooks/useCalendar";
import { Picker } from "../today/pickers/Picker";
import { CalendarSettings } from "./CalendarSettings";
import { MeetingSettings } from "./MeetingSettings";

type SettingsViewProps = {
  calendar: CalendarState;
  settings: Settings;
  onChange: <K extends keyof Settings>(name: K, value: Settings[K]) => void;
  /** Back to the app. */
  onBack: () => void;
  /** Close hides Timi to the tray, as in the title bar. */
  onClose: () => void;
  /** "wide" centres the 380px screen in the wide window (drafted). */
  variant: "expanded" | "wide";
};

function Row({
  title,
  sub,
  children,
  last = false,
}: {
  title: string;
  sub: string;
  children: ReactNode;
  last?: boolean;
}) {
  return (
    <div className={`flex min-h-13 items-center gap-2.5 px-3 py-1.5 ${last ? "" : "border-b border-ink-muted/8"}`}>
      <div className="flex-1 leading-[1.3]">
        <div className="text-ui font-medium">{title}</div>
        <div className="text-meta text-ink-muted">{sub}</div>
      </div>
      {children}
    </div>
  );
}

/** Settings (4e): General, Meetings and Google Calendar. */
export function SettingsView({ calendar, settings, onChange, onBack, onClose, variant }: SettingsViewProps) {
  const toast = useToast();
  // Null while loading
  const [startOnLogin, setStartOnLogin] = useState<boolean | null>(null);
  const [shortcutReady, setShortcutReady] = useState(true);
  const [version, setVersion] = useState("");
  const [reminderOpen, setReminderOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    autostartEnabled()
      .then((enabled) => {
        if (!cancelled) setStartOnLogin(enabled);
      })
      .catch((error: unknown) => {
        console.error("[settings] autostart check failed", error);
      });
    quickAddShortcutRegistered()
      .then((registered) => {
        if (!cancelled) setShortcutReady(registered);
      })
      .catch((error: unknown) => {
        console.error("[settings] shortcut check failed", error);
      });
    getVersion()
      .then((value) => {
        if (!cancelled) setVersion(value);
      })
      .catch((error: unknown) => {
        console.error("[settings] version failed", error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const changeStartOnLogin = (next: boolean): void => {
    setStartOnLogin(next);
    (next ? enableAutostart() : disableAutostart())
      .then(() => autostartEnabled())
      .then(setStartOnLogin)
      .catch((error: unknown) => {
        console.error("[settings] autostart change failed", error);
        setStartOnLogin(!next);
        toast({ message: "Couldn’t change start on login. Try again.", tone: "error" });
      });
  };

  return (
    <div className={`relative z-1 flex min-h-0 flex-1 flex-col ${variant === "wide" ? "mx-auto w-95" : ""}`}>
      <div className="flex h-12 shrink-0 items-center gap-1.5 px-2">
        <button
          type="button"
          aria-label="Back"
          title="Back"
          onClick={onBack}
          className="grid size-8 place-items-center rounded-sm text-ink hover:bg-white/75"
        >
          <Icon name="arrow_back" size={20} />
        </button>
        <h1
          onMouseDown={handleDragMouseDown}
          className="m-0 flex h-full flex-1 cursor-grab items-center text-[14px] font-bold"
        >
          Settings
        </h1>
        <IconButton icon="close" label="Close" onClick={onClose} />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-auto px-3 pb-3.5 [scrollbar-width:thin]">
        <section aria-labelledby="settings-general" className="flex flex-col gap-1.5">
          <h2 id="settings-general" className="m-0 px-1 text-label tracking-[0.07em] text-ink-muted uppercase">
            General
          </h2>
          <div className="flex flex-col rounded-lg border border-white/90 bg-white/60 backdrop-blur-glass">
            <Row title="Start on login" sub="Open Timi pinned when Windows starts">
              <Switch
                checked={startOnLogin ?? false}
                disabled={startOnLogin === null}
                label="Start on login"
                onChange={changeStartOnLogin}
              />
            </Row>
            <Row title="Carry over unfinished tasks" sub="Tagged “from yesterday” the next day">
              <Switch
                checked={settings.carryOver}
                label="Carry over unfinished tasks"
                onChange={(next) => {
                  onChange("carryOver", next);
                }}
              />
            </Row>
            <Row
              title="Global shortcut"
              sub={shortcutReady ? "Quick add from any app" : "In use by another app — use Quick add in the tray"}
            >
              <span
                className={`flex h-8 items-center rounded-tile border border-ink-muted/18 bg-white px-2.5 font-mono text-meta font-medium ${
                  shortcutReady ? "" : "text-ink-muted line-through"
                }`}
              >
                Ctrl Shift Space
              </span>
            </Row>
            <Row title="Default reminder" sub="For tasks you give a reminder" last>
              <span className="relative">
                <button
                  type="button"
                  aria-haspopup="listbox"
                  aria-expanded={reminderOpen}
                  aria-label={`Default reminder: ${reminderLength(settings.defaultReminderMinutes)}`}
                  onClick={() => {
                    setReminderOpen(!reminderOpen);
                  }}
                  className="flex h-8 items-center gap-1 rounded-tile border border-ink-muted/18 bg-white pr-2 pl-2.5 font-mono text-caption font-medium hover:bg-white/80"
                >
                  {reminderLength(settings.defaultReminderMinutes)}
                  <Icon name="expand_more" size={17} className="text-ink-muted" />
                </button>
                {reminderOpen && (
                  <Picker
                    label="Default reminder"
                    align="right"
                    options={QUICK_REMINDERS.map((minutes) => ({
                      id: String(minutes),
                      label: reminderLength(minutes),
                    }))}
                    selectedId={String(settings.defaultReminderMinutes)}
                    selectedClass="bg-accent/14"
                    checkClass="text-accent-ink"
                    onSelect={(id) => {
                      setReminderOpen(false);
                      onChange("defaultReminderMinutes", Number(id));
                    }}
                    onClose={() => {
                      setReminderOpen(false);
                    }}
                  />
                )}
              </span>
            </Row>
          </div>
        </section>

        <MeetingSettings settings={settings} onChange={onChange} />

        <CalendarSettings calendar={calendar} />

        <p className="m-0 text-center text-duration text-ink-muted">
          Timi{version ? ` ${version}` : ""} · all data stored locally first
        </p>
      </div>
    </div>
  );
}
