import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  calendarEvents,
  calendarStatus,
  connectCalendar,
  disconnectCalendar,
  isConnectError,
  setIncludedCalendars,
  syncCalendar,
  type CalendarEvent,
  type CalendarStatus,
  type ConnectError,
} from "../data/calendar";

export type CalendarState = {
  /** Null until loaded. */
  status: CalendarStatus | null;
  /** Bumped whenever events may have changed, so range hooks reload. */
  version: number;
  connecting: boolean;
  /** Why the last Connect failed, until the next attempt. */
  connectError: ConnectError | null;
  connect: () => void;
  disconnect: () => void;
  retry: () => void;
  setIncluded: (ids: string[]) => void;
};

/**
 * Google Calendar status. Rust syncs every five minutes; this also asks for a sync when the
 * window gains focus, and reloads when Rust reports `calendar-changed`.
 */
export function useCalendar(): CalendarState {
  const [status, setStatus] = useState<CalendarStatus | null>(null);
  const [version, setVersion] = useState(0);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<ConnectError | null>(null);

  const refresh = useCallback((): void => {
    calendarStatus()
      .then((next) => {
        setStatus(next);
        setVersion((count) => count + 1);
      })
      .catch((error: unknown) => {
        console.error("[calendar] status failed", error);
      });
  }, []);

  useEffect(() => {
    refresh();
    const unlisten = listen("calendar-changed", refresh);
    const onFocus = (): void => {
      syncCalendar(false).catch((error: unknown) => {
        console.error("[calendar] sync failed", error);
      });
    };
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      void unlisten.then((stop) => {
        stop();
      });
    };
  }, [refresh]);

  const connect = useCallback((): void => {
    setConnecting(true);
    setConnectError(null);
    connectCalendar()
      .then(setStatus)
      .catch((error: unknown) => {
        console.error("[calendar] connect failed", error);
        setConnectError(isConnectError(error) ? error : "network");
      })
      .finally(() => {
        setConnecting(false);
      });
  }, []);

  const disconnect = useCallback((): void => {
    disconnectCalendar()
      .then(setStatus)
      .catch((error: unknown) => {
        console.error("[calendar] disconnect failed", error);
      });
  }, []);

  const retry = useCallback((): void => {
    syncCalendar(true).catch((error: unknown) => {
      console.error("[calendar] sync failed", error);
    });
  }, []);

  const setIncluded = useCallback(
    (ids: string[]): void => {
      setStatus((current) =>
        current
          ? { ...current, calendars: current.calendars.map((c) => ({ ...c, included: ids.includes(c.id) })) }
          : current,
      );
      setIncludedCalendars(ids)
        .then(setStatus)
        .catch((error: unknown) => {
          console.error("[calendar] include failed", error);
          refresh();
        });
    },
    [refresh],
  );

  return { status, version, connecting, connectError, connect, disconnect, retry, setIncluded };
}

export type EventsState = { status: "loading" | "ready" | "error"; events: CalendarEvent[] };

/** Cached events for [startMs, endMs), reloaded when the calendar changes. Empty when not connected. */
export function useCalendarEvents(calendar: CalendarState, startMs: number, endMs: number): EventsState {
  const [state, setState] = useState<EventsState>({ status: "loading", events: [] });
  const loadId = useRef(0);
  const connected = calendar.status?.connected ?? false;

  useEffect(() => {
    const id = ++loadId.current;
    if (!connected) {
      setState({ status: "ready", events: [] });
      return;
    }
    calendarEvents(startMs, endMs)
      .then((events) => {
        if (id === loadId.current) setState({ status: "ready", events });
      })
      .catch((error: unknown) => {
        console.error("[calendar] events failed", error);
        if (id === loadId.current) setState((prev) => ({ ...prev, status: "error" }));
      });
  }, [connected, startMs, endMs, calendar.version]);

  return state;
}
