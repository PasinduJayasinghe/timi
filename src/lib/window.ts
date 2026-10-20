import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";

export type WindowMode = "expanded" | "wide" | "mini";

/** Logical window sizes from the design: 1a expanded, 1d wide, 1e mini bar. */
const WINDOW_SIZES: Record<WindowMode, { width: number; height: number }> = {
  expanded: { width: 380, height: 780 },
  wide: { width: 760, height: 600 },
  mini: { width: 380, height: 56 },
};

function logError(action: string, error: unknown): void {
  console.error(`[window] ${action} failed`, error);
}

/** Starts a native window drag. Call from a primary-button mousedown. */
export async function startDrag(): Promise<void> {
  try {
    await getCurrentWindow().startDragging();
  } catch (error) {
    logError("startDragging", error);
  }
}

export async function setPinned(pinned: boolean): Promise<boolean> {
  try {
    await getCurrentWindow().setAlwaysOnTop(pinned);
    return true;
  } catch (error) {
    logError("setAlwaysOnTop", error);
    return false;
  }
}

export async function resizeForMode(mode: WindowMode): Promise<void> {
  const { width, height } = WINDOW_SIZES[mode];
  try {
    await getCurrentWindow().setSize(new LogicalSize(width, height));
  } catch (error) {
    logError("setSize", error);
  }
}

/** Close hides Timi to the tray; Quit is in the tray menu. */
export async function hideToTray(): Promise<void> {
  try {
    await getCurrentWindow().hide();
  } catch (error) {
    logError("hide", error);
  }
}
