import { useEffect, useState } from "react";
import { isSameLocalDay, msUntilNextLocalMidnight } from "../lib/date";

/**
 * The current local date. Updates at local midnight, and re-checks when the
 * window regains focus or becomes visible, because timers can stall while the PC sleeps.
 */
export function useLocalDate(): Date {
  const [today, setToday] = useState<Date>(() => new Date());

  useEffect(() => {
    const refresh = (): void => {
      const now = new Date();
      setToday((prev) => (isSameLocalDay(prev, now) ? prev : now));
    };

    // +1s so the timer lands safely after midnight
    const timeoutId = window.setTimeout(refresh, msUntilNextLocalMidnight(new Date()) + 1000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [today]);

  return today;
}
