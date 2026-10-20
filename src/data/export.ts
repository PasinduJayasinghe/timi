import { invoke } from "@tauri-apps/api/core";
import type { SessionExportRow, TaskExportRow } from "../lib/exportRows";

/**
 * Asks where to save and writes the workbook (src-tauri/src/export.rs). Resolves with the saved
 * path, or null if the Save As dialog was cancelled.
 */
export function exportXlsx(
  fileName: string,
  tasks: TaskExportRow[],
  sessions: SessionExportRow[],
): Promise<string | null> {
  return invoke<string | null>("export_xlsx", { request: { fileName, tasks, sessions } });
}

/** Opens an exported workbook in Excel (or the default app). */
export function openExport(path: string): Promise<void> {
  return invoke<void>("open_export", { path });
}
