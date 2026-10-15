import { Icon } from "./Icon";
import { LiveDuration, type LiveTotal } from "./LiveDuration";

type TimelineCollapsedBarProps = {
  total: LiveTotal;
  onExpand: () => void;
};

/** Collapsed timeline bar (1a/1b/1f): today's total; opens the timeline panel. */
export function TimelineCollapsedBar({ total, onExpand }: TimelineCollapsedBarProps) {
  return (
    <button
      type="button"
      aria-expanded={false}
      title="Show timeline"
      onClick={onExpand}
      className="relative z-1 mx-2 mb-2 flex h-10 shrink-0 items-center gap-2 rounded-md border border-white/85 bg-white/55 pr-1.5 pl-3 text-caption font-semibold text-ink shadow-bar backdrop-blur-glass hover:bg-white/75"
    >
      <Icon name="view_timeline" size={17} className="text-accent-ink" />
      Timeline
      <span className="flex-1" />
      <span className="font-mono font-medium whitespace-nowrap">
        <LiveDuration {...total} /> today
      </span>
      <span className="grid size-8 place-items-center text-ink-muted">
        <Icon name="expand_less" size={18} />
      </span>
    </button>
  );
}
