import { useEffect, useState } from "react";
import { writesSettled } from "../data/db";
import * as sessionStore from "../data/sessions";
import * as taskStore from "../data/tasks";
import { addDays } from "../lib/date";
import { totalSeconds } from "../lib/sessionMath";

/** Tracked time and finished tasks of a shift's day, for the Between shifts card (7k). */
export function useDaySummary(dayKey: string | null): {
  trackedSeconds: number | null;
  doneCount: number | null;
} {
  const [summary, setSummary] = useState<{
    trackedSeconds: number | null;
    doneCount: number | null;
  }>({
    trackedSeconds: null,
    doneCount: null,
  });

  useEffect(() => {
    let cancelled = false;
    setSummary({ trackedSeconds: null, doneCount: null });
    if (dayKey === null) return;
    const load = async (): Promise<void> => {
      await writesSettled();
      const [sessions, doneCount] = await Promise.all([
        sessionStore.listForDays(dayKey, addDays(dayKey, 1)),
        taskStore.countDone(dayKey),
      ]);
      if (!cancelled)
        setSummary({
          trackedSeconds: totalSeconds(sessions, Date.now()),
          doneCount,
        });
    };
    load().catch((error: unknown) => {
      // The card works without the numbers
      console.error("[shift] summary load failed", error);
    });
    return () => {
      cancelled = true;
    };
  }, [dayKey]);

  return summary;
}
