import { useEffect, useState } from "react";
import { msUntilNextDayStart, workDayKey } from "../lib/date";

/**
 * Today's work day key ("YYYY-MM-DD"; the day starts at 6 am). Updates when the next day starts,
 * and re-checks when the window regains focus or becomes visible, because timers can stall while
 * the PC sleeps.
 */
export function useTodayKey(): string {
  const [day, setDay] = useState<string>(() => workDayKey(new Date()));

  useEffect(() => {
    const refresh = (): void => {
      setDay(workDayKey(new Date()));
    };

    // +1s so the timer lands safely after the day starts
    const timeoutId = window.setTimeout(refresh, msUntilNextDayStart(new Date()) + 1000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [day]);

  return day;
}
