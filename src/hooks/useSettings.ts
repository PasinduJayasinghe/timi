import { useCallback, useEffect, useState } from "react";
import { DEFAULT_SETTINGS, loadSettings, saveSetting, type Settings } from "../data/settings";

export type SettingsState = {
  /** Null until loaded. */
  settings: Settings | null;
  update: <K extends keyof Settings>(name: K, value: Settings[K]) => void;
};

/** App preferences. If they can't be read, the defaults apply, so Timi still works. */
export function useSettings(onSaveError: () => void): SettingsState {
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadSettings()
      .then((loaded) => {
        if (!cancelled) setSettings(loaded);
      })
      .catch((error: unknown) => {
        console.error("[settings] load failed", error);
        if (!cancelled) setSettings(DEFAULT_SETTINGS);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback(
    <K extends keyof Settings>(name: K, value: Settings[K]): void => {
      setSettings((current) => ({ ...(current ?? DEFAULT_SETTINGS), [name]: value }));
      saveSetting(name, value).catch((error: unknown) => {
        console.error("[settings] save failed", error);
        onSaveError();
      });
    },
    [onSaveError],
  );

  return { settings, update };
}
