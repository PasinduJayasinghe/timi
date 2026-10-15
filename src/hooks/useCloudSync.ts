import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { cloudStatus, cloudUpload } from "../data/cloud";
import { nowIso, queueWrite, writesSettled } from "../data/db";
import { countPendingUploads, listPendingUploads, markSynced } from "../data/sessions";
import { isSyncError, syncStatus, toUploadRow, type SyncError, type SyncStatus } from "../lib/cloudSync";
import type { Timer } from "./useTimer";

/** Sessions read per upload round. */
const BATCH = 500;
/** A safety stop for one sync run. */
const MAX_ROUNDS = 20;
const SYNC_EVERY_MS = 5 * 60_000;

export type CloudSync = {
  status: SyncStatus;
  error: SyncError | null;
  /** Sessions waiting to upload. */
  pending: number;
  retry: () => void;
};

/**
 * Offline-first upload of closed sessions (Phase 6a). Sessions are always saved on this PC
 * first; this uploads the ones waiting after a session closes, every five minutes, when the
 * window gets focus and when the PC comes back online. `offlineRef` tells the timer to show the
 * "Saved offline" toast (2e).
 */
export function useCloudSync(timer: Timer, offlineRef: MutableRefObject<boolean>): CloudSync {
  const [configured, setConfigured] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<SyncError | null>(null);
  const [pending, setPending] = useState(0);
  const busy = useRef(false);

  useEffect(() => {
    cloudStatus()
      .then((status) => {
        setConfigured(status.configured);
      })
      .catch((failure: unknown) => {
        console.error("[sync] status failed", failure);
      });
  }, []);

  const run = useCallback(async (): Promise<void> => {
    if (!configured || busy.current) return;
    busy.current = true;
    try {
      await writesSettled();
      for (let round = 0; round < MAX_ROUNDS; round++) {
        // Read time, so edits made while uploading still count as waiting
        const listedAt = nowIso();
        const batch = await listPendingUploads(BATCH);
        if (batch.length === 0) {
          setPending(0);
          setError(null);
          return;
        }
        setPending(await countPendingUploads());
        setUploading(true);
        try {
          const ids = await cloudUpload(batch.map(toUploadRow));
          const uploaded = batch.filter((session) => ids.includes(session.id));
          await queueWrite(() => markSynced(uploaded, listedAt));
          setError(null);
        } catch (failure) {
          console.error("[sync] upload failed", failure);
          setError(isSyncError(failure) ? failure : "network");
          setPending(await countPendingUploads());
          return;
        }
        if (batch.length < BATCH) {
          setPending(await countPendingUploads());
          return;
        }
      }
    } catch (failure) {
      console.error("[sync] failed", failure);
    } finally {
      busy.current = false;
      setUploading(false);
    }
  }, [configured]);

  // After a session closes (pause, switch, recovery, meeting end)
  const closedToday = timer.todaySessions.filter((session) => session.endedAt !== null).length;
  useEffect(() => {
    void run();
  }, [run, closedToday]);

  useEffect(() => {
    const trigger = (): void => {
      void run();
    };
    const intervalId = window.setInterval(trigger, SYNC_EVERY_MS);
    window.addEventListener("focus", trigger);
    window.addEventListener("online", trigger);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", trigger);
      window.removeEventListener("online", trigger);
    };
  }, [run]);

  const status = syncStatus({ configured, uploading, error, pending });
  useEffect(() => {
    offlineRef.current = status === "offline";
  }, [offlineRef, status]);

  const retry = useCallback((): void => {
    void run();
  }, [run]);

  return { status, error, pending, retry };
}
