import type { PendingUpload } from "../data/sessions";
import { workDayKey } from "./date";

/** Why an upload didn't happen (src-tauri/src/cloud.rs). */
export type SyncError = "not-configured" | "signed-out" | "network" | "auth" | "rejected";

/** The footer sync chip (2e). "off" means this build has no Supabase project: no chip, local only. */
export type SyncStatus = "off" | "saved" | "syncing" | "offline";

/** One row for the Supabase table, in the shape `cloud_upload` reads. */
export type UploadRow = PendingUpload & { workDay: string };

export function toUploadRow(session: PendingUpload): UploadRow {
  return { ...session, workDay: workDayKey(new Date(session.startedAt)) };
}

export function isSyncError(value: unknown): value is SyncError {
  return (
    value === "not-configured" ||
    value === "signed-out" ||
    value === "network" ||
    value === "auth" ||
    value === "rejected"
  );
}

export function syncStatus(state: {
  configured: boolean;
  uploading: boolean;
  error: SyncError | null;
  pending: number;
}): SyncStatus {
  if (!state.configured) return "off";
  if (state.uploading) return "syncing";
  if (state.pending === 0) return "saved";
  return state.error ? "offline" : "syncing";
}

const sessions = (count: number): string => `${count} ${count === 1 ? "session" : "sessions"}`;

/** Chip tooltip (2e script; the sign-in and refused cases are drafted). */
export function syncTooltip(status: SyncStatus, error: SyncError | null, pending: number): string {
  if (status === "saved") return "All sessions saved and synced";
  if (status === "syncing") return `Syncing ${sessions(pending)}…`;
  if (error === "signed-out") return "Saved on this device · connect Google Calendar in Settings to back up sessions";
  if (error === "auth") return "Saved on this device · sign in to Google Calendar again to back up sessions";
  if (error === "rejected") return `Saved on this device · the company server didn’t accept ${sessions(pending)}`;
  return `Saved on this device, will sync later · ${sessions(pending)} waiting`;
}
