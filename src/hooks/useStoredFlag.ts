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

/** One of a fixed set of choices remembered in this browser profile, such as the window mode. */
export function useStoredChoice<T extends string>(
  key: string,
  choices: readonly T[],
  initial: T,
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      return choices.find((choice) => choice === stored) ?? initial;
    } catch {
      return initial;
    }
  });

  const update = useCallback(
    (next: T): void => {
      setValue(next);
      try {
        localStorage.setItem(key, next);
      } catch {
        // Storage unavailable: keep the value for this session
      }
    },
    [key],
  );

  return [value, update];
}
