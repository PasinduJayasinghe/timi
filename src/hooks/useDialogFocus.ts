import { useCallback, useEffect, type KeyboardEvent, type RefObject } from "react";

const FOCUSABLE = "button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex='0']";

/**
 * Focus handling for sheets and dialogs: focuses `[data-autofocus]` (or the dialog) on open and
 * gives focus back to the opener on close. The returned key handler closes on Esc and keeps Tab
 * inside the dialog.
 */
export function useDialogFocus(
  ref: RefObject<HTMLElement | null>,
  onClose: () => void,
): (event: KeyboardEvent<HTMLElement>) => void {
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = ref.current;
    (dialog?.querySelector<HTMLElement>("[data-autofocus]") ?? dialog)?.focus();
    return () => {
      if (opener?.isConnected) opener.focus();
    };
    // Only on open and close
  }, []);

  return useCallback(
    (event: KeyboardEvent<HTMLElement>): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = ref.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [onClose, ref],
  );
}
