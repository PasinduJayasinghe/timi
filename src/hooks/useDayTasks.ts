import { useCallback, useEffect, useRef, useState } from "react";
import { writesSettled } from "../data/db";
import * as taskStore from "../data/tasks";
import type { Task } from "../data/types";
import type { ListStatus } from "./useTodayTasks";

/** The tasks listed on a past day, read-only (the Log's Tasks card). Pass null to load nothing. */
export function useDayTasks(day: string | null): { status: ListStatus; tasks: Task[]; reload: () => void } {
  const [status, setStatus] = useState<ListStatus>("loading");
  const [tasks, setTasks] = useState<Task[]>([]);
  const loadId = useRef(0);

  const load = useCallback(async (): Promise<void> => {
    const id = ++loadId.current;
    if (day === null) return;
    setStatus("loading");
    try {
      await writesSettled();
      const list = await taskStore.listForDay(day);
      if (id !== loadId.current) return;
      setTasks(list);
      setStatus("ready");
    } catch (error) {
      console.error("[log] tasks load failed", error);
      if (id === loadId.current) setStatus("error");
    }
  }, [day]);

  useEffect(() => {
    void load();
  }, [load]);

  const reload = useCallback((): void => {
    void load();
  }, [load]);

  return { status, tasks, reload };
}
