import { Icon } from "../../components/Icon";
import { IconButton } from "../../components/IconButton";
import { formatShortDate } from "../../lib/date";

type LogEmptyProps = {
  date: Date;
  /** "expanded" follows 3f; "wide" follows 3g. */
  variant?: "expanded" | "wide";
};

/**
 * Log tab with no sessions. Not in the design: the empty message was drafted for Phase 0
 * and approved with the plan. The day picker is inert until Phase 2.
 */
export function LogEmpty({ date, variant = "expanded" }: LogEmptyProps) {
  const wide = variant === "wide";

  return (
    <div className={`relative z-1 flex min-h-0 flex-1 flex-col ${wide ? "" : "px-3 pb-3"}`}>
      <div className={`flex items-center ${wide ? "gap-1.5 pb-2.5" : "gap-0.5 pb-2"}`}>
        <IconButton icon="chevron_left" label="Previous day" inert className="hover:bg-white/80" />
        <button
          type="button"
          aria-disabled="true"
          className={`flex h-8 items-center gap-1.5 rounded-sm px-2.5 text-ui font-semibold text-ink hover:bg-white ${
            wide ? "bg-white" : "bg-white/60"
          }`}
        >
          <Icon name="calendar_today" size={16} className="text-accent-ink" />
          {wide ? formatShortDate(date) : `Today · ${formatShortDate(date)}`}
        </button>
        <button
          type="button"
          aria-label="Next day"
          title="Next day"
          disabled
          className="grid size-8 cursor-default place-items-center rounded-sm text-ink-disabled"
        >
          <Icon name="chevron_right" size={18} />
        </button>
        <span className="flex-1" />
        {!wide && <span className="font-mono text-timer font-semibold">0m</span>}
      </div>

      <div
        className={`flex min-h-0 flex-1 flex-col justify-center gap-2.5 overflow-hidden rounded-panel border border-white/85 px-7 ${
          wide ? "bg-white/60" : "bg-white/55 backdrop-blur-glass"
        }`}
      >
        <h2 className="m-0 text-display">Nothing logged yet.</h2>
        <p className="m-0 text-body leading-[1.55] font-normal text-pretty text-ink-muted">
          Start a timer on a task and each session shows up here with its start, end and duration — ready to copy into
          your timesheet.
        </p>
      </div>
    </div>
  );
}
