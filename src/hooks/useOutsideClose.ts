import { useEffect, type RefObject } from "react";

/**
 * Closes a dropdown when the pointer goes down outside it. The dropdown's parent counts as
 * inside, because it wraps the field that toggles the dropdown: clicking that field again
 * shouldn't close and then reopen it.
 */
export function useOutsideClose(ref: RefObject<HTMLElement | null>, onClose: () => void): void {
  useEffect(() => {
    const onPointerDown = (event: PointerEvent): void => {
      const area = ref.current?.parentElement ?? ref.current;
      if (area && !area.contains(event.target as Node)) onClose();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [onClose, ref]);
}
