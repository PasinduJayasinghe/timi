import { useCallback, useEffect, useRef, useState } from "react";
import { writesSettled } from "../data/db";
import * as sessionStore from "../data/sessions";
import type { Session } from "../data/types";
import { addDays } from "../lib/date";
import type { ListStatus } from "./useTodayTasks";

export type DaySessions = {
  status: ListStatus;
  sessions: Session[];
  reload: () => void;
};

/** Sessions of a past work day, for the Log. Pass null to load nothing (today comes from the timer). */
export function useDaySessions(day: string | null): DaySessions {
  return useSessionsForDays(day, day === null ? null : addDays(day, 1));
}

/** Sessions of the work days in [fromDay, toDay), e.g. a week. Pass nulls to load nothing. */
export function useSessionsForDays(fromDay: string | null, toDay: string | null): DaySessions {
  const [status, setStatus] = useState<ListStatus>("loading");
  const [sessions, setSessions] = useState<Session[]>([]);
  const loadId = useRef(0);

  const load = useCallback(async (): Promise<void> => {
    const id = ++loadId.current;
    if (fromDay === null || toDay === null) return;
    setStatus("loading");
    try {
      await writesSettled();
      const list = await sessionStore.listForDays(fromDay, toDay);
      if (id !== loadId.current) return;
      setSessions(list);
      setStatus("ready");
    } catch (error) {
      console.error("[sessions] load failed", error);
      if (id === loadId.current) setStatus("error");
    }
  }, [fromDay, toDay]);

  useEffect(() => {
    void load();
  }, [load]);

  const reload = useCallback((): void => {
    void load();
  }, [load]);

  return { status, sessions, reload };
}
