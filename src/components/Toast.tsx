import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Icon } from "./Icon";

/** success: green check (2e "Session saved"); neutral: muted icon (2e "Saved offline"); error: drafted. */
export type ToastTone = "success" | "neutral" | "error";

export type ToastMessage = {
  message: string;
  tone?: ToastTone;
  icon?: string;
  action?: { label: string; onClick: () => void };
};

type ToastState = ToastMessage & { key: number };

type ToastContextValue = {
  show: (toast: ToastMessage) => void;
  current: ToastState | null;
  dismiss: () => void;
  pause: () => void;
  resume: () => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

function useToastContext(): ToastContextValue {
  const value = useContext(ToastContext);
  if (!value) throw new Error("Toast components must be inside <ToastProvider>");
  return value;
}

/** Shows one toast at a time. Later toasts replace earlier ones. */
export function useToast(): (toast: ToastMessage) => void {
  return useToastContext().show;
}

/** 5s rather than the design script's 3.2s, so the Undo action is reachable. */
const VISIBLE_MS = 5000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<ToastState | null>(null);
  const timeoutRef = useRef<number | undefined>(undefined);

  const pause = useCallback((): void => {
    window.clearTimeout(timeoutRef.current);
  }, []);

  const resume = useCallback((): void => {
    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      setCurrent(null);
    }, VISIBLE_MS);
  }, []);

  const dismiss = useCallback((): void => {
    window.clearTimeout(timeoutRef.current);
    setCurrent(null);
  }, []);

  const show = useCallback(
    (next: ToastMessage): void => {
      setCurrent((prev) => ({ ...next, key: (prev?.key ?? 0) + 1 }));
      resume();
    },
    [resume],
  );

  useEffect(() => {
    return () => {
      window.clearTimeout(timeoutRef.current);
    };
  }, []);

  const value = useMemo(() => ({ show, current, dismiss, pause, resume }), [show, current, dismiss, pause, resume]);
  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

const TONE_ICON: Record<ToastTone, { icon: string; className: string }> = {
  success: { icon: "check_circle", className: "text-status-success" },
  neutral: { icon: "info", className: "text-status-offline" },
  error: { icon: "error", className: "text-status-error" },
};

/** Where the toast appears (2e style). `bottomClass` keeps it above the footer and timeline bar. */
export function ToastViewport({ bottomClass }: { bottomClass: string }) {
  const { current, dismiss, pause, resume } = useToastContext();
  const tone = current?.tone ?? "neutral";

  return (
    <div aria-live="polite" className={`pointer-events-none absolute right-4 left-4 z-30 ${bottomClass}`}>
      {current && (
        <div
          key={current.key}
          role={tone === "error" ? "alert" : "status"}
          onMouseEnter={pause}
          onMouseLeave={resume}
          onFocus={pause}
          onBlur={resume}
          className="pointer-events-auto flex animate-toast-in items-center gap-2 rounded-md border border-white bg-white/95 py-2.5 pr-2 pl-3 text-ui font-medium text-ink shadow-toast"
        >
          <Icon
            name={current.icon ?? TONE_ICON[tone].icon}
            size={18}
            fill={tone === "success"}
            className={TONE_ICON[tone].className}
          />
          <span className="flex-1">{current.message}</span>
          {current.action && (
            <button
              type="button"
              onClick={() => {
                current.action?.onClick();
                dismiss();
              }}
              className="-my-1.5 h-8 rounded-sm px-2 text-caption font-semibold text-accent-ink hover:bg-accent/12"
            >
              {current.action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
