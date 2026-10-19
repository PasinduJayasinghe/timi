import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { Icon, type IconName } from "../../components/Icon";

type ShiftSheetProps = {
  title: string;
  icon: IconName;
  iconClass: string;
  variant: "expanded" | "wide";
  onClose: () => void;
  /** Step dots and "1 of 2" (Plan my day). */
  steps?: { current: number; total: number };
  children: ReactNode;
};

/** A 2a-style sheet for the shift screens (7d, 7j): backdrop, focus kept inside, Esc closes. */
export function ShiftSheet({ title, icon, iconClass, variant, onClose, steps, children }: ShiftSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  // Focus the first control on open; give focus back to the button that opened the sheet on close
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const sheet = sheetRef.current;
    (sheet?.querySelector<HTMLElement>("[data-autofocus]") ?? sheet)?.focus();
    return () => {
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    } else if (event.key === "Tab") {
      const focusable = sheetRef.current?.querySelectorAll<HTMLElement>(
        "button:not([disabled]), input:not([disabled]), [tabindex='0']",
      );
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
    }
  };

  return (
    <div className="absolute inset-0 z-40">
      <div
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 animate-fade-in bg-ink/16 backdrop-blur-backdrop"
      />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className={`absolute right-0 bottom-0 left-0 flex animate-sheet-in flex-col gap-3.5 overflow-y-auto rounded-t-sheet rounded-b-xl border border-white/95 bg-white/82 px-4 pt-2 pb-4 shadow-sheet backdrop-blur-sheet backdrop-saturate-150 [scrollbar-width:thin] focus-visible:outline-none ${
          variant === "wide" ? "top-3" : "top-18"
        }`}
      >
        <div aria-hidden="true" className="h-1 w-9 shrink-0 self-center rounded-[2px] bg-ink-muted/30" />
        <div className="-mt-1 flex shrink-0 items-center gap-2">
          <span className="flex flex-1 items-center gap-1.5 text-title tracking-title">
            <Icon name={icon} size={18} className={iconClass} />
            {title}
          </span>
          {steps && steps.total > 1 && (
            <span className="flex items-center gap-2">
              <span aria-hidden="true" className="flex items-center gap-1">
                {Array.from({ length: steps.total }, (_, index) => (
                  <span
                    key={index}
                    className={`h-1.5 rounded-[3px] ${index + 1 === steps.current ? "w-4.5" : "w-1.5"} ${
                      index + 1 <= steps.current ? "bg-accent-ink" : "bg-ink-muted/25"
                    }`}
                  />
                ))}
              </span>
              <span className="font-mono text-meta text-ink-muted">
                {steps.current} of {steps.total}
              </span>
            </span>
          )}
          <button
            type="button"
            aria-label="Close"
            title="Close"
            onClick={onClose}
            className="grid size-8 place-items-center rounded-sm bg-ink-muted/8 text-ink-muted hover:bg-ink-muted/16 hover:text-ink"
          >
            <Icon name="close" size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** The sheet's main button (2a CTA), with a secondary button beside it. */
export function SheetActions({
  primary,
  primaryIcon,
  onPrimary,
  secondary,
  onSecondary,
  autoFocus = false,
}: {
  primary: string;
  primaryIcon: IconName;
  onPrimary: () => void;
  secondary: string;
  onSecondary: () => void;
  autoFocus?: boolean;
}) {
  return (
    <div className="mt-auto grid shrink-0 grid-cols-[1fr_auto] gap-2">
      <button
        type="button"
        data-autofocus={autoFocus ? true : undefined}
        onClick={onPrimary}
        className="flex h-11 items-center justify-center gap-1.5 rounded-md bg-accent-gradient-strong text-body font-semibold text-white shadow-copy focus-visible:outline-offset-3"
      >
        <Icon name={primaryIcon} size={20} fill />
        {primary}
      </button>
      <button
        type="button"
        onClick={onSecondary}
        className="h-11 rounded-md bg-white/60 px-4 text-ui font-semibold text-ink-muted hover:bg-white hover:text-ink"
      >
        {secondary}
      </button>
    </div>
  );
}
