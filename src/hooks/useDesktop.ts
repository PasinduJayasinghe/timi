import { useEffect, useRef } from "react";
import { writesSettled } from "../data/db";
import type { Task } from "../data/types";
import {
  onDesktopEvent,
  quitApp,
  setReminders,
  setTrayState,
  type ScheduledReminder,
  type TrayTimerAction,
} from "../lib/desktop";
import { formatTimeOfDay } from "../lib/duration";
import { displayTitle, sessionDisplay, whoLabel } from "../lib/taskDisplay";
import type { Workday } from "./useWorkday";

/** "Snooze 10 min" on a reminder toast (4c). */
const SNOOZE_MS = 10 * 60_000;

type DesktopOptions = {
  work: Workday;
  /** The open task the tray's Resume restarts (the mini bar's paused task), if any. */
  resumable: Task | null;
  /** Ctrl+Shift+Space or the tray's Quick add: show Today with the quick add field focused. */
  onQuickAdd: () => void;
  /** The tray's Start task…: open the Start task sheet. */
  onStartSheet: () => void;
};

/** Toast text (4c): "Reminder · 11:55 pm · Client B". */
function reminderBody(task: Task, remindAt: string): string {
  const who = whoLabel(task);
  return `Reminder · ${formatTimeOfDay(remindAt)}${who ? ` · ${who}` : ""}`;
}

/**
 * Connects Timi to the desktop: tray menu, global quick add, reminder toasts and Quit.
 * Rust shows the tray and the toasts; this keeps their state in sync and handles their actions.
 */
export function useDesktop(options: DesktopOptions): void {
  const latest = useRef(options);
  latest.current = options;

  // Listen once; handlers read the latest options
  useEffect(() => {
    const unlisteners = [
      onDesktopEvent("quick-add", () => {
        latest.current.onQuickAdd();
      }),
      onDesktopEvent("reminder-action", ({ taskId, action }) => {
        const { work } = latest.current;
        // The task may have been deleted since the reminder was scheduled
        if (!work.list.tasks.some((task) => task.id === taskId)) return;
        if (action === "start") work.startTask(taskId);
        else work.list.update(taskId, { remindAt: new Date(Date.now() + SNOOZE_MS).toISOString() });
      }),
      onDesktopEvent("tray-action", ({ action }) => {
        const { work, resumable, onStartSheet } = latest.current;
        if (action === "pause") work.timer.pause();
        else if (action === "resume" && resumable) work.startTask(resumable.id);
        else onStartSheet();
      }),
      onDesktopEvent("quit-requested", () => {
        // Save a running timer before quitting, as if it were paused
        latest.current.work.timer.pause();
        void writesSettled().finally(() => {
          quitApp().catch((error: unknown) => {
            console.error("[desktop] quit failed", error);
          });
        });
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

  // Tray menu: the running timer, and what its timer item does
  const { running } = options.work.timer;
  const runningTitle = running ? displayTitle(sessionDisplay(running)) : null;
  const runningStart = running ? Date.parse(running.startedAt) : null;
  const resumableId = options.resumable?.id ?? null;
  useEffect(() => {
    let action: TrayTimerAction = "start";
    if (runningTitle !== null) action = "pause";
    else if (resumableId !== null) action = "resume";
    setTrayState({
      running:
        runningTitle !== null && runningStart !== null ? { title: runningTitle, startedAtMs: runningStart } : null,
      action,
    }).catch((error: unknown) => {
      console.error("[desktop] tray update failed", error);
    });
  }, [runningTitle, runningStart, resumableId]);

  // Reminder schedule: open tasks on today's list with a reminder still ahead
  const { tasks, status } = options.work.list;
  useEffect(() => {
    if (status !== "ready") return;
    const now = Date.now();
    const reminders: ScheduledReminder[] = tasks.flatMap((task) => {
      if (!task.remindAt || task.completedAt) return [];
      const atMs = Date.parse(task.remindAt);
      if (atMs <= now) return [];
      return [{ taskId: task.id, title: displayTitle(task), body: reminderBody(task, task.remindAt), atMs }];
    });
    setReminders(reminders).catch((error: unknown) => {
      console.error("[desktop] reminder schedule failed", error);
    });
  }, [tasks, status]);
}
