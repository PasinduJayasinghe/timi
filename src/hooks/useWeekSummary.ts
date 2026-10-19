import { useCallback, useEffect, useRef, useState } from "react";
import { writesSettled } from "../data/db";
import * as taskStore from "../data/tasks";
import type { DayTotals } from "../data/tasks";

/**
 * Tasks and estimates per day for the week starting `weekStart` (the Plan week strip, 7a).
 * Reloads whenever `version` changes, e.g. when the selected day's list changes.
 */
export function useWeekSummary(weekStart: string, weekEnd: string, version: string): ReadonlyMap<string, DayTotals> {
  const [totals, setTotals] = useState<ReadonlyMap<string, DayTotals>>(new Map());
  const loadId = useRef(0);

  const load = useCallback(async (): Promise<void> => {
    const id = ++loadId.current;
    try {
      await writesSettled();
      const next = await taskStore.weekSummary(weekStart, weekEnd);
      if (id === loadId.current) setTotals(next);
    } catch (error) {
      // Only a hint in the strip; the day itself still loads
      console.error("[plan] week summary failed", error);
    }
  }, [weekStart, weekEnd]);

  useEffect(() => {
    void load();
  }, [load, version]);

  return totals;
}
