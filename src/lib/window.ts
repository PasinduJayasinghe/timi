import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";

export type WindowMode = "expanded" | "wide" | "mini";

/** An edge or corner of the window to resize from (the same names as Tauri's resize directions). */
export type ResizeEdge = "North" | "South" | "East" | "West" | "NorthEast" | "NorthWest" | "SouthEast" | "SouthWest";

/**
 * Logical window sizes from the design: 1a expanded, 1d wide, 1e mini bar. Expanded and wide
 * can be made bigger by dragging the edges (Phase 12); these are their smallest sizes.
 */
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

type Size = { width: number; height: number };

const sizeKey = (mode: WindowMode): string => `timi.windowSize.${mode}`;

/** The size last dragged to in a mode, never smaller than the design size. */
function storedSize(mode: WindowMode): Size {
  const smallest = WINDOW_SIZES[mode];
  try {
    const raw = localStorage.getItem(sizeKey(mode));
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === "object" && "width" in parsed && "height" in parsed) {
      const { width, height } = parsed;
      if (typeof width === "number" && typeof height === "number") {
        return { width: Math.max(width, smallest.width), height: Math.max(height, smallest.height) };
      }
    }
  } catch {
    // Storage blocked or unreadable: use the design size
  }
  return smallest;
}

/** Remembers the size the window was dragged to in a resizable mode. */
export function rememberSize(mode: WindowMode, size: Size): void {
  if (mode === "mini") return;
  try {
    localStorage.setItem(
      sizeKey(mode),
      JSON.stringify({ width: Math.round(size.width), height: Math.round(size.height) }),
    );
  } catch {
    // Not remembered; the design size is used next time
  }
}

/** Sizes the window for a mode: the mini bar is fixed; expanded and wide resize from their design size up. */
export async function resizeForMode(mode: WindowMode): Promise<void> {
  const window = getCurrentWindow();
  try {
    if (mode === "mini") {
      await window.setResizable(false);
      await window.setMinSize(null);
      const { width, height } = WINDOW_SIZES.mini;
      await window.setSize(new LogicalSize(width, height));
      return;
    }
    const smallest = WINDOW_SIZES[mode];
    const { width, height } = storedSize(mode);
    await window.setMinSize(null);
    await window.setSize(new LogicalSize(width, height));
    await window.setMinSize(new LogicalSize(smallest.width, smallest.height));
    await window.setResizable(true);
  } catch (error) {
    logError("resize", error);
  }
}

/** Starts resizing from an edge or corner of the frameless window. Call from a primary-button mousedown. */
export async function startResize(direction: ResizeEdge): Promise<void> {
  try {
    await getCurrentWindow().startResizeDragging(direction);
  } catch (error) {
    logError("startResizeDragging", error);
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
