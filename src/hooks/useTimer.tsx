import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ToastMessage } from "../components/Toast";
import { nowIso, queueWrite, writesSettled } from "../data/db";
import * as sessionStore from "../data/sessions";
import type { Session, Task } from "../data/types";
import { addDays } from "../lib/date";
import { formatDuration } from "../lib/duration";
import { HEARTBEAT_MS, isStale, secondsByTask, sessionSeconds } from "../lib/sessionMath";
import { displayTitle, sessionDisplay } from "../lib/taskDisplay";
import { styleOf } from "../lib/taskTypes";
import type { ListStatus } from "./useTodayTasks";

/** The task fields a session shows. */
export type TimerTask = Pick<
  Task,
  "id" | "title" | "type" | "ticketNumber" | "clientName" | "projectName" | "calendarEventId"
>;

export type Timer = {
  status: ListStatus;
  /** The open session, if any. Only one runs at a time. */
  running: Session | null;
  /** Sessions that started today, oldest first (the running one included). */
  todaySessions: Session[];
  /** Seconds in closed sessions per task, across all days, for today's tasks. */
  trackedByTask: Map<string, number>;
  /** Starts timing a task. A running timer is paused and saved first. */
  start: (task: TimerTask) => void;
  /** Stops the running timer and saves the session. */
  pause: () => void;
  /** Stops the running timer without the Undo toast (End shift, 7j). */
  stopQuietly: () => void;
  reload: () => void;
};

type ShowToast = (toast: ToastMessage) => void;

/** Duration in toasts: never "0m", as in the 1a script. */
const toastDuration = (session: Session): string => formatDuration(Math.max(60, sessionSeconds(session, Date.now())));

function Mono({ children }: { children: string }) {
  return <span className="font-mono">{children}</span>;
}

/**
 * Timer state: one running session, today's sessions and tracked time per task.
 *
 * While a session runs, its "last seen" time is written every minute (and on focus). If Timi
 * wasn't seen for longer than STALE_AFTER_MS (crash, shutdown or sleep), the session is closed
 * at the last seen time. Changes apply optimistically; a failed write reloads from the database.
 */
export function useTimer(
  day: string,
  taskIds: readonly string[],
  onSaveError: () => void,
  showToast: ShowToast,
  /** True while sync is offline: a saved session gets the "Saved offline" toast (2e). */
  offlineRef?: { readonly current: boolean },
): Timer {
  const [status, setStatus] = useState<ListStatus>("loading");
  const [running, setRunningState] = useState<Session | null>(null);
  const [todaySessions, setTodaySessions] = useState<Session[]>([]);
  const [closed, setClosed] = useState<Session[]>([]);

  // Refs so back-to-back actions see the latest state before React re-renders
  const runningRef = useRef<Session | null>(null);
  const lastSeenRef = useRef<string | null>(null);
  const loadId = useRef(0);

  const setRunning = useCallback((session: Session | null, seenAt: string | null): void => {
    runningRef.current = session;
    lastSeenRef.current = seenAt;
    setRunningState(session);
  }, []);

  /** Local state for a session that just closed. */
  const applyStop = useCallback(
    (session: Session): void => {
      setRunning(null, null);
      setTodaySessions((list) => list.map((s) => (s.id === session.id ? session : s)));
      setClosed((list) => [...list.filter((s) => s.id !== session.id), session]);
    },
    [setRunning],
  );

  const recover = useCallback(
    (session: Session, lastSeen: string): void => {
      const stopped = { ...session, endedAt: lastSeen };
      applyStop(stopped);
      queueWrite(() => sessionStore.stop(session.id, lastSeen)).catch((error: unknown) => {
        console.error("[timer] recovery failed", error);
      });
      showToast({
        tone: "neutral",
        icon: "history",
        message: (
          <>
            Timer stopped while Timi was off · saved <Mono>{toastDuration(stopped)}</Mono>
          </>
        ),
      });
    },
    [applyStop, showToast],
  );

  const loadDay = useCallback(async (): Promise<void> => {
    const id = ++loadId.current;
    try {
      await writesSettled();
      const [open, sessions] = await Promise.all([
        sessionStore.getRunning(),
        sessionStore.listForDays(day, addDays(day, 1)),
      ]);
      if (id !== loadId.current) return;
      setTodaySessions(sessions);
      setStatus("ready");
      const lastSeen = open ? (open.lastSeenAt ?? open.startedAt) : null;
      if (open && lastSeen && isStale(lastSeen, Date.now())) recover(open, lastSeen);
      else setRunning(open, lastSeen);
    } catch (error) {
      console.error("[timer] load failed", error);
      if (id === loadId.current) setStatus("error");
    }
  }, [day, recover, setRunning]);

  useEffect(() => {
    void loadDay();
  }, [loadDay]);

  // Closed sessions of today's tasks (including days before, for carried-over tasks)
  const taskKey = [...taskIds].sort().join(",");
  const loadTracked = useCallback(async (): Promise<void> => {
    try {
      await writesSettled();
      const ids = taskKey === "" ? [] : taskKey.split(",");
      setClosed(await sessionStore.listClosedForTasks(ids));
    } catch (error) {
      console.error("[timer] tracked load failed", error);
    }
  }, [taskKey]);

  useEffect(() => {
    void loadTracked();
  }, [loadTracked]);

  const reload = useCallback((): void => {
    setStatus("loading");
    void loadDay();
    void loadTracked();
  }, [loadDay, loadTracked]);

  const write = useCallback(
    (run: () => Promise<unknown>): void => {
      queueWrite(run).catch((error: unknown) => {
        console.error("[timer] save failed", error);
        onSaveError();
        void loadDay();
        void loadTracked();
      });
    },
    [loadDay, loadTracked, onSaveError],
  );

  const undo = useCallback(
    (session: Session): void => {
      const failed = (): void => {
        showToast({ message: "Couldn’t resume that timer.", tone: "error" });
      };
      if (runningRef.current) {
        failed();
        return;
      }
      const seenAt = nowIso();
      const reopened = { ...session, endedAt: null, lastSeenAt: seenAt };
      setRunning(reopened, seenAt);
      setTodaySessions((list) => list.map((s) => (s.id === session.id ? reopened : s)));
      setClosed((list) => list.filter((s) => s.id !== session.id));
      queueWrite(() => sessionStore.reopen(session.id, seenAt))
        .then((ok) => {
          if (ok) return;
          failed();
          void loadDay();
          void loadTracked();
        })
        .catch((error: unknown) => {
          console.error("[timer] undo failed", error);
          failed();
          void loadDay();
          void loadTracked();
        });
    },
    [loadDay, loadTracked, setRunning, showToast],
  );

  const pause = useCallback((): void => {
    const session = runningRef.current;
    if (!session) return;
    const endedAt = nowIso();
    const stopped = { ...session, endedAt };
    applyStop(stopped);
    write(() => sessionStore.stop(session.id, endedAt));
    const undoAction = {
      label: "Undo",
      onClick: () => {
        undo(stopped);
      },
    };
    if (offlineRef?.current) {
      showToast({
        tone: "neutral",
        icon: "cloud_off",
        message: "Session saved on this device · will sync when you’re back online",
        action: undoAction,
      });
      return;
    }
    showToast({
      tone: "success",
      message: (
        <>
          Session saved · <Mono>{toastDuration(stopped)}</Mono> · {styleOf(sessionDisplay(session)).label}
        </>
      ),
      action: undoAction,
    });
  }, [applyStop, offlineRef, showToast, undo, write]);

  const stopQuietly = useCallback((): void => {
    const session = runningRef.current;
    if (!session) return;
    const endedAt = nowIso();
    applyStop({ ...session, endedAt });
    write(() => sessionStore.stop(session.id, endedAt));
  }, [applyStop, write]);

  const start = useCallback(
    (task: TimerTask): void => {
      const previous = runningRef.current;
      if (previous?.taskId === task.id) return;
      const startedAt = nowIso();
      const session: Session = {
        id: crypto.randomUUID(),
        taskId: task.id,
        dayKey: day,
        startedAt,
        endedAt: null,
        lastSeenAt: startedAt,
        taskTitle: task.title,
        taskType: task.type,
        ticketNumber: task.ticketNumber,
        clientName: task.clientName,
        projectName: task.projectName,
        calendarEventId: task.calendarEventId,
      };
      const stopped = previous ? { ...previous, endedAt: startedAt } : null;
      if (stopped) applyStop(stopped);
      setRunning(session, startedAt);
      setTodaySessions((list) => [...list, session]);
      write(async () => {
        await sessionStore.stopRunning(startedAt);
        await sessionStore.insert(session);
      });
      if (stopped) {
        showToast({
          icon: "swap_horiz",
          tone: "accent",
          multiline: true,
          message: (
            <>
              <b className="font-semibold">{displayTitle(sessionDisplay(stopped))}</b> paused and saved (
              <Mono>{toastDuration(stopped)}</Mono>). Now timing <b className="font-semibold">{displayTitle(task)}</b>.
            </>
          ),
        });
      }
    },
    [applyStop, day, setRunning, showToast, write],
  );

  // Heartbeat and gap check while a session runs
  const runningId = running?.id ?? null;
  useEffect(() => {
    if (runningId === null) return;
    const check = (): void => {
      const session = runningRef.current;
      if (!session) return;
      const now = Date.now();
      const lastSeen = lastSeenRef.current ?? session.startedAt;
      if (isStale(lastSeen, now)) {
        recover(session, lastSeen);
        return;
      }
      const seenAt = new Date(now).toISOString();
      lastSeenRef.current = seenAt;
      queueWrite(() => sessionStore.heartbeat(session.id, seenAt)).catch((error: unknown) => {
        console.error("[timer] heartbeat failed", error);
      });
    };
    // Right away too: after a restart within the gap, the stored last seen time is minutes old
    check();
    const intervalId = window.setInterval(check, HEARTBEAT_MS);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [runningId, recover]);

  const trackedByTask = useMemo(() => secondsByTask(closed, Date.now()), [closed]);

  return { status, running, todaySessions, trackedByTask, start, pause, stopQuietly, reload };
}
