import { getDb, queueWrite } from "./db";

/** App preferences from Settings (4e). Start on login is kept by the autostart plugin itself. */
export type Settings = {
  /** Unfinished tasks move to the new day, tagged "from yesterday". */
  carryOver: boolean;
  /** The quick reminder highlighted first in the Reminder picker, in minutes. */
  defaultReminderMinutes: number;
  /** "Alert before meeting" (4e): 1, 5, 10 or 15 minutes. */
  meetingAlertMinutes: number;
  /** "Alarm sound: Gentle chime" (4e). */
  meetingChime: boolean;
  /** "Always start automatically when I join" (4b). */
  autoStartMeetingTimer: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  carryOver: true,
  defaultReminderMinutes: 30,
  meetingAlertMinutes: 5,
  meetingChime: true,
  autoStartMeetingTimer: false,
};

const KEYS: Record<keyof Settings, string> = {
  carryOver: "carry_over",
  defaultReminderMinutes: "default_reminder_minutes",
  meetingAlertMinutes: "meeting_alert_minutes",
  meetingChime: "meeting_chime",
  autoStartMeetingTimer: "auto_start_meeting_timer",
};

type SettingRow = { key: string; value: string };

function parse<K extends keyof Settings>(key: K, value: string): Settings[K] | undefined {
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === typeof DEFAULT_SETTINGS[key] ? (parsed as Settings[K]) : undefined;
  } catch {
    return undefined;
  }
}

/** Stored settings, with defaults for anything missing or unreadable. */
export async function loadSettings(): Promise<Settings> {
  const db = await getDb();
  const rows = await db.select<SettingRow[]>("SELECT key, value FROM settings");
  const settings: Settings = { ...DEFAULT_SETTINGS };
  for (const name of Object.keys(KEYS) as Array<keyof Settings>) {
    const row = rows.find((r) => r.key === KEYS[name]);
    const value = row ? parse(name, row.value) : undefined;
    if (value !== undefined) Object.assign(settings, { [name]: value });
  }
  return settings;
}

export function saveSetting<K extends keyof Settings>(name: K, value: Settings[K]): Promise<void> {
  return queueWrite(async () => {
    const db = await getDb();
    await db.execute(
      "INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
      [KEYS[name], JSON.stringify(value)],
    );
  });
}
