import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

/**
 * The Rust side of Phase 4: tray menu, reminder scheduler, global shortcut and quit.
 * Commands are defined in src-tauri/src (lib.rs, tray.rs, reminders.rs).
 */

/** What the tray's timer item does (4d). */
export type TrayTimerAction = "pause" | "resume" | "start";

export type TrayState = {
  running: { title: string; startedAtMs: number } | null;
  action: TrayTimerAction;
};

export function setTrayState(state: TrayState): Promise<void> {
  return invoke("set_tray_state", state);
}

/** One scheduled reminder toast (4c). */
export type ScheduledReminder = {
  taskId: string;
  title: string;
  /** e.g. "Reminder · 11:55 pm · Client B". */
  body: string;
  atMs: number;
};

/** Replaces the whole reminder schedule. */
export function setReminders(reminders: ScheduledReminder[]): Promise<void> {
  return invoke("set_reminders", { reminders });
}

/** Quits for real (Close only hides to the tray). */
export function quitApp(): Promise<void> {
  return invoke("quit_app");
}

/** False when another app already owns Ctrl+Shift+Space. */
export function quickAddShortcutRegistered(): Promise<boolean> {
  return invoke<boolean>("quick_add_shortcut_registered");
}

export type DesktopEvents = {
  /** Ctrl+Shift+Space or the tray's Quick add. */
  "quick-add": null;
  /** A button on a reminder toast. */
  "reminder-action": { taskId: string; action: "start" | "snooze" };
  /** The tray menu's timer item. */
  "tray-action": { action: TrayTimerAction };
  /** Quit from the tray: save a running timer, then call quitApp. */
  "quit-requested": null;
};

export function onDesktopEvent<K extends keyof DesktopEvents>(
  name: K,
  handler: (payload: DesktopEvents[K]) => void,
): Promise<UnlistenFn> {
  return listen<DesktopEvents[K]>(name, (event) => {
    handler(event.payload);
  });
}
