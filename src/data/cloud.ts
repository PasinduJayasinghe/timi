import { invoke } from "@tauri-apps/api/core";
import type { UploadRow } from "../lib/cloudSync";

/**
 * Session upload to the company Supabase project (src-tauri/src/cloud.rs). Rust signs in with
 * the Google account from Calendar; the web view only hands over rows.
 */

/** Whether this build has a Supabase project (.env). Without one, Timi stays local only. */
export function cloudStatus(): Promise<{ configured: boolean }> {
  return invoke<{ configured: boolean }>("cloud_status");
}

/** Upserts the rows and returns the ids uploaded. Rejects with a SyncError string. */
export function cloudUpload(rows: UploadRow[]): Promise<string[]> {
  return invoke<string[]>("cloud_upload", { rows });
}
