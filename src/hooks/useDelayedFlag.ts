import { useEffect, useState } from "react";

/** Loading placeholders appear only if loading takes longer than this, to avoid a flash. */
const LOADING_DELAY_MS = 200;

/** True once `active` has stayed true for `delay` milliseconds. */
export function useDelayedFlag(active: boolean, delay = LOADING_DELAY_MS): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!active) {
      setShown(false);
      return;
    }
    const timeoutId = window.setTimeout(() => {
      setShown(true);
    }, delay);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [active, delay]);
  return shown;
}
