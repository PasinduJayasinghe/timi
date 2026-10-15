import { useCallback, useEffect, useRef, useState } from "react";
import { writesSettled } from "../data/db";
import * as sessionStore from "../data/sessions";
import type { Session } from "../data/types";
import { workDayRange } from "../lib/date";
import type { ListStatus } from "./useTodayTasks";

export type DaySessions = {
  status: ListStatus;
  sessions: Session[];
  reload: () => void;
};

/** Sessions that started on a past day, for the Log. Pass null to load nothing (today comes from the timer). */
export function useDaySessions(day: string | null): DaySessions {
  const range = day === null ? null : workDayRange(day);
  return useSessionsBetween(range?.start ?? null, range?.end ?? null);
}

/** Sessions that started in [start, end) (UTC ISO), e.g. a week. Pass nulls to load nothing. */
export function useSessionsBetween(start: string | null, end: string | null): DaySessions {
  const [status, setStatus] = useState<ListStatus>("loading");
  const [sessions, setSessions] = useState<Session[]>([]);
  const loadId = useRef(0);

  const load = useCallback(async (): Promise<void> => {
    const id = ++loadId.current;
    if (start === null || end === null) return;
    setStatus("loading");
    try {
      await writesSettled();
      const list = await sessionStore.listBetween(start, end);
      if (id !== loadId.current) return;
      setSessions(list);
      setStatus("ready");
    } catch (error) {
      console.error("[sessions] load failed", error);
      if (id === loadId.current) setStatus("error");
    }
  }, [start, end]);

  useEffect(() => {
    void load();
  }, [load]);

  const reload = useCallback((): void => {
    void load();
  }, [load]);

  return { status, sessions, reload };
}
