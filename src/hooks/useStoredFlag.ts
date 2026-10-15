import { useCallback, useState } from "react";

/**
 * A yes/no preference remembered in this browser profile, such as whether the timeline is open.
 * Storage can be unavailable; the flag then lasts for this session only.
 */
export function useStoredFlag(key: string, initial: boolean): [boolean, (value: boolean) => void] {
  const [value, setValue] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored === null ? initial : stored === "true";
    } catch {
      return initial;
    }
  });

  const update = useCallback(
    (next: boolean): void => {
      setValue(next);
      try {
        localStorage.setItem(key, String(next));
      } catch {
        // Storage unavailable: keep the value for this session
      }
    },
    [key],
  );

  return [value, update];
}
