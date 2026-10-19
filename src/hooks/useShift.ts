import { useCallback, useEffect, useRef, useState } from "react";
import { nowIso, queueWrite, writesSettled } from "../data/db";
import * as sessionStore from "../data/sessions";
import * as shiftStore from "../data/shifts";
import * as taskStore from "../data/tasks";
import { msUntilNextDayStart, workDayKey } from "../lib/date";
import { isStale } from "../lib/sessionMath";
import { autoEndAt, nextShiftDay, type Shift } from "../lib/shift";

export type ShiftView =
  | { status: "loading" }
  | { status: "error" }
  | { status: "open"; shift: Shift }
  /** After End shift (7k). `last` is the shift that ended. */
  | { status: "between"; last: Shift };

export type ShiftState = {
  view: ShiftView;
  /** Today's work day: the open shift's day, or the day the next shift will start on. */
  todayKey: string;
  /** False until the shift is known, so `todayKey` won't change under a first load. */
  ready: boolean;
  /** A shift Timi ended because it was left open, until its note is dismissed (7l). */
  notice: Shift | null;
  /** Starts a shift between shifts. Resolves once it is saved (and leftovers carried over, if Plan my day is off). */
  start: () => Promise<void>;
  /** Starts a shift if none is open: adding a task or starting a timer between shifts (7i). */
  ensure: () => void;
  /** Ends the open shift. Stop the timer first. */
  end: () => void;
  /** Reopens the shift that just ended (7k). */
  reopen: () => void;
  dismissNotice: () => void;
  /** Checks again whether a forgotten shift should end, e.g. after the timer stops. */
  recheck: () => void;
  reload: () => void;
};

/** Forgotten shifts are checked this often while Timi stays open, as well as on focus. */
const RECHECK_MS = 15 * 60 * 1000;

/** The day the next shift starts on, between shifts. */
function nextKey(current: ShiftView): string {
  return nextShiftDay(new Date(), current.status === "between" ? current.last.dayKey : null);
}

/**
 * The work day comes from shifts (Phase 7): a day runs from Start shift to End shift, and 6 am is
 * only the fallback for a shift left open (`autoEndAt`). The first run with shifts opens one for
 * the current work day, so nothing changes on upgrade.
 */
export function useShift(
  planMyDay: boolean,
  onSaveError: () => void,
  /** After a shift started with Plan my day off, once leftovers were carried over: reload the list. */
  onCarriedOver: () => void,
): ShiftState {
  const [view, setView] = useState<ShiftView>({ status: "loading" });
  const [notice, setNoticeState] = useState<Shift | null>(null);
  const noticeRef = useRef<Shift | null>(null);
  const setNotice = useCallback((shift: Shift | null): void => {
    noticeRef.current = shift;
    setNoticeState(shift);
  }, []);
  // Re-renders when the next shift's day may have changed (focus, or the next 6 am)
  const [clock, setClock] = useState(() => Date.now());
  const viewRef = useRef<ShiftView>(view);
  viewRef.current = view;
  const planMyDayRef = useRef(planMyDay);
  planMyDayRef.current = planMyDay;
  const onCarriedOverRef = useRef(onCarriedOver);
  onCarriedOverRef.current = onCarriedOver;
  const loadId = useRef(0);

  const load = useCallback(async (): Promise<void> => {
    const id = ++loadId.current;
    try {
      await writesSettled();
      let open = await shiftStore.getOpen();
      let ended: Shift | null = null;
      if (open) {
        const [running, last] = await Promise.all([sessionStore.getRunning(), shiftStore.lastActivity(open.dayKey)]);
        // A running session not seen for a while is closed by the timer at its last seen time
        const timing = running !== null && !isStale(running.lastSeenAt ?? running.startedAt, Date.now());
        const endAt = autoEndAt(open, last, Date.now(), timing);
        if (endAt) {
          const shift = open;
          await queueWrite(() => shiftStore.end(shift.id, endAt, "auto"));
          ended = { ...shift, endedAt: endAt, endedBy: "auto" };
          open = null;
        }
      }
      let latest = open ?? ended ?? (await shiftStore.getLatest());
      if (!latest) {
        // First run with shifts: open one for the current work day
        const startedAt = nowIso();
        const shift: Shift = {
          id: crypto.randomUUID(),
          dayKey: workDayKey(new Date()),
          startedAt,
          endedAt: null,
          endedBy: null,
          noticedAt: null,
        };
        await queueWrite(() => shiftStore.start(shift));
        // Read it back: a second load at the same moment may have saved its own row for the day
        open = (await shiftStore.getOpen()) ?? shift;
        latest = open;
      }
      if (id !== loadId.current) return;
      setView(open ? { status: "open", shift: open } : { status: "between", last: latest });
      setNotice(latest.endedBy === "auto" && latest.noticedAt === null ? latest : null);
    } catch (error) {
      console.error("[shift] load failed", error);
      if (id === loadId.current) setView({ status: "error" });
    }
  }, [setNotice]);

  useEffect(() => {
    void load();
  }, [load]);

  const failed = useCallback(
    (error: unknown): void => {
      console.error("[shift] save failed", error);
      onSaveError();
      void load();
    },
    [load, onSaveError],
  );

  const recheck = useCallback((): void => {
    setClock(Date.now());
    if (viewRef.current.status === "open") void load();
  }, [load]);

  useEffect(() => {
    const timeoutId = window.setTimeout(recheck, msUntilNextDayStart(new Date()) + 1000);
    const intervalId = window.setInterval(recheck, RECHECK_MS);
    window.addEventListener("focus", recheck);
    document.addEventListener("visibilitychange", recheck);
    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
      window.removeEventListener("focus", recheck);
      document.removeEventListener("visibilitychange", recheck);
    };
  }, [recheck, clock]);

  const start = useCallback((): Promise<void> => {
    const current = viewRef.current;
    if (current.status !== "between") return Promise.resolve();
    const shift: Shift = {
      id: crypto.randomUUID(),
      dayKey: nextKey(current),
      startedAt: nowIso(),
      endedAt: null,
      endedBy: null,
      noticedAt: null,
    };
    const carryOver = !planMyDayRef.current;
    const opened: ShiftView = { status: "open", shift };
    viewRef.current = opened;
    setView(opened);
    setNotice(null);
    return queueWrite(async () => {
      await shiftStore.start(shift);
      // Plan my day off: unfinished tasks come over on their own, as before shifts
      if (carryOver) await taskStore.carryOver(shift.dayKey);
    })
      .then(() => {
        if (carryOver) onCarriedOverRef.current();
        // Read back the saved shift: starting on a day that already had one reopens that row
        void load();
      })
      .catch(failed);
  }, [failed, load, setNotice]);

  const ensure = useCallback((): void => {
    void start();
  }, [start]);

  const end = useCallback((): void => {
    const current = viewRef.current;
    if (current.status !== "open") return;
    const endedAt = nowIso();
    const last: Shift = { ...current.shift, endedAt, endedBy: "user" };
    const between: ShiftView = { status: "between", last };
    viewRef.current = between;
    setView(between);
    setNotice(null);
    queueWrite(() => shiftStore.end(current.shift.id, endedAt, "user")).catch(failed);
  }, [failed, setNotice]);

  const reopen = useCallback((): void => {
    const current = viewRef.current;
    if (current.status !== "between") return;
    const shift: Shift = {
      ...current.last,
      endedAt: null,
      endedBy: null,
      noticedAt: null,
    };
    const opened: ShiftView = { status: "open", shift };
    viewRef.current = opened;
    setView(opened);
    setNotice(null);
    queueWrite(() => shiftStore.reopen(shift.id, nowIso()))
      .then((ok) => {
        if (!ok) failed(new Error("another shift is open"));
      })
      .catch(failed);
  }, [failed, setNotice]);

  const dismissNotice = useCallback((): void => {
    const shift = noticeRef.current;
    setNotice(null);
    if (!shift) return;
    queueWrite(() => shiftStore.markNoticed(shift.id, nowIso())).catch((error: unknown) => {
      console.error("[shift] notice save failed", error);
    });
  }, [setNotice]);

  const reload = useCallback((): void => {
    setView({ status: "loading" });
    void load();
  }, [load]);

  let todayKey: string;
  if (view.status === "open") todayKey = view.shift.dayKey;
  else if (view.status === "between") todayKey = nextShiftDay(new Date(clock), view.last.dayKey);
  else todayKey = workDayKey(new Date(clock));

  return {
    view,
    todayKey,
    ready: view.status === "open" || view.status === "between",
    notice,
    start,
    ensure,
    end,
    reopen,
    dismissNotice,
    recheck,
    reload,
  };
}
