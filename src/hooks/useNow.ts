import { useEffect, useState } from "react";

/**
 * The current time in ms, re-rendering once a second while `active`.
 * The interval only triggers a render: elapsed time is always worked out from stored timestamps.
 */
export function useNow(active: boolean): number {
  const [, setRenders] = useState(0);

  useEffect(() => {
    if (!active) return;
    const intervalId = window.setInterval(() => {
      setRenders((count) => count + 1);
    }, 1000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [active]);

  return Date.now();
}

/** `baseSeconds` plus the time since `runningSince`, kept live while something runs. */
export function useLiveSeconds(baseSeconds: number, runningSince: string | null): number {
  const now = useNow(runningSince !== null);
  if (runningSince === null) return baseSeconds;
  return baseSeconds + Math.max(0, (now - Date.parse(runningSince)) / 1000);
}
