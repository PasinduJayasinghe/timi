import { useCallback, useEffect, useRef, useState } from "react";
import { writesSettled } from "../data/db";
import * as taskStore from "../data/tasks";
import type { Task } from "../data/types";
import type { ListStatus } from "./useTodayTasks";

/**
 * Tasks listed on the days in [fromDay, toDay) (the wide Plan's week columns, 8b). Reloads when
 * `version` changes, e.g. after a task moves.
 */
export function useDayRangeTasks(
  fromDay: string,
  toDay: string,
  version: string,
): { status: ListStatus; tasks: Task[] } {
  const [state, setState] = useState<{ status: ListStatus; tasks: Task[] }>({ status: "loading", tasks: [] });
  const loadId = useRef(0);

  const load = useCallback(async (): Promise<void> => {
    const id = ++loadId.current;
    try {
      await writesSettled();
      const tasks = await taskStore.listForDayRange(fromDay, toDay);
      if (id === loadId.current) setState({ status: "ready", tasks });
    } catch (error) {
      console.error("[plan] week tasks load failed", error);
      if (id === loadId.current) setState((current) => ({ ...current, status: "error" }));
    }
  }, [fromDay, toDay]);

  useEffect(() => {
    void load();
  }, [load, version]);

  return state;
}
