import { useRef, type ReactNode } from "react";
import { CloseButton } from "../../components/CloseButton";
import { Icon, type IconName } from "../../components/Icon";
import { useDialogFocus } from "../../hooks/useDialogFocus";

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

  // Focus on open, give it back on close; Esc closes and Tab stays inside
  const onKeyDown = useDialogFocus(sheetRef, onClose);

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
          <CloseButton onClick={onClose} />
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
  disabled = false,
}: {
  primary: string;
  primaryIcon: IconName;
  onPrimary: () => void;
  secondary: string;
  onSecondary: () => void;
  autoFocus?: boolean;
  /** Greys out the main button, e.g. Export with nothing to export (9b). */
  disabled?: boolean;
}) {
  return (
    <div className="mt-auto grid shrink-0 grid-cols-[1fr_auto] gap-2">
      <button
        type="button"
        data-autofocus={autoFocus ? true : undefined}
        disabled={disabled}
        onClick={onPrimary}
        className={`flex h-11 items-center justify-center gap-1.5 rounded-md text-body font-semibold focus-visible:outline-offset-3 ${
          disabled
            ? "cursor-default bg-ink-muted/12 text-ink-disabled"
            : "bg-accent-gradient-strong text-white shadow-copy"
        }`}
      >
        <Icon name={primaryIcon} size={20} fill={!disabled} />
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
