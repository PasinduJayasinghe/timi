import type { ReactNode } from "react";
import { Icon } from "./Icon";
import { LiveDuration, type LiveTotal } from "./LiveDuration";

type FooterBarProps = {
  /** Today's tracked total. */
  total: LiveTotal;
  /** "expanded" is 1a/1b (40px, top border); "wide" is 1d (38px). */
  variant?: "expanded" | "wide";
  /** The sync chip (2e), on the right. */
  sync?: ReactNode;
};

/** Footer with today's total and the sync chip. */
export function FooterBar({ total, variant = "expanded", sync }: FooterBarProps) {
  const layout = variant === "expanded" ? "h-10 border-t border-white/70 px-3.5" : "h-9.5 px-4";
  return (
    <div className={`relative z-1 flex shrink-0 items-center justify-between ${layout}`}>
      <div className="flex items-center gap-1.5 text-caption text-ink-muted">
        <Icon name="schedule" size={16} />
        Today
        <span className="font-mono text-ui font-semibold whitespace-nowrap text-ink">
          <LiveDuration {...total} />
        </span>
      </div>
      {sync}
    </div>
  );
}
