import { useState } from "react";
import { Icon } from "../../components/Icon";
import { IconButton } from "../../components/IconButton";
import type { Session } from "../../data/types";
import { useDaySessions } from "../../hooks/useDaySessions";
import type { Timer } from "../../hooks/useTimer";
import type { ListStatus } from "../../hooks/useTodayTasks";
import { addDays, formatShortDate, fromLocalDayKey } from "../../lib/date";
import { TimelineRows, type TimelineRowsProps } from "./TimelineRows";

type BarActions = Pick<TimelineRowsProps, "canOpen" | "onOpen">;

/** Couldn't load a day's sessions (drafted; the panel is too small for the full 3c alert). */
function TimelineError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-1 items-center justify-center gap-1.5 text-caption text-status-error">
      <Icon name="sync_problem" size={16} />
      Couldn’t load this day
      <button
        type="button"
        onClick={onRetry}
        className="h-8 rounded-sm px-2 font-semibold text-accent-ink hover:bg-accent/12"
      >
        Retry
      </button>
    </div>
  );
}

type DayView = { status: ListStatus; sessions: readonly Session[]; reload: () => void };

function DayRows({
  view,
  dayKey,
  isToday,
  variant,
  ...actions
}: BarActions & {
  view: DayView;
  dayKey: string;
  isToday: boolean;
  variant: TimelineRowsProps["variant"];
}) {
  if (view.status === "error") return <TimelineError onRetry={view.reload} />;
  return (
    <div aria-busy={view.status === "loading"} className="flex min-h-0 flex-1">
      <TimelineRows
        variant={variant}
        dayKey={dayKey}
        // Empty tracks while loading
        sessions={view.status === "ready" ? view.sessions : []}
        isToday={isToday}
        {...actions}
      />
    </div>
  );
}

type TimelinePanelProps = BarActions & {
  todayKey: string;
  /** Today's sessions come from the timer, so the running bar stays live. */
  timer: Timer;
  onCollapse: () => void;
};

/** Timeline panel in the expanded window (1a): day switcher, rows and totals, and collapse. */
export function TimelinePanel({ todayKey, timer, onCollapse, ...actions }: TimelinePanelProps) {
  // Days back from today, so the panel moves on when a new work day starts
  const [offset, setOffset] = useState(0);
  const day = addDays(todayKey, offset);
  const isToday = offset === 0;
  const past = useDaySessions(isToday ? null : day);
  const view: DayView = isToday ? { status: timer.status, sessions: timer.todaySessions, reload: timer.reload } : past;

  return (
    <section
      aria-label="Timeline"
      className="relative z-1 mx-2 mb-2 flex h-53 shrink-0 flex-col rounded-panel border border-white/85 bg-white/55 px-2.5 pt-1.5 pb-2.5 shadow-md backdrop-blur-glass backdrop-saturate-140"
    >
      <div className="flex h-8.5 shrink-0 items-center gap-0.5">
        <h2 className="m-0 flex-1 text-caption font-semibold">Timeline</h2>
        <IconButton
          icon="chevron_left"
          label="Previous day"
          onClick={() => {
            setOffset(offset - 1);
          }}
          className="hover:bg-white/80"
        />
        <button
          type="button"
          title={isToday ? undefined : "Back to today"}
          onClick={() => {
            setOffset(0);
          }}
          className="h-8 rounded-sm bg-white/75 px-2.5 text-caption font-semibold text-ink hover:bg-white"
        >
          {isToday ? "Today" : formatShortDate(fromLocalDayKey(day))}
        </button>
        <button
          type="button"
          aria-label="Next day"
          title="Next day"
          disabled={isToday}
          onClick={() => {
            setOffset(Math.min(0, offset + 1));
          }}
          className="grid size-8 place-items-center rounded-sm text-ink-muted hover:bg-white/80 hover:text-ink disabled:cursor-default disabled:bg-transparent disabled:text-ink-disabled"
        >
          <Icon name="chevron_right" size={18} />
        </button>
        <IconButton
          icon="expand_more"
          label="Collapse timeline"
          aria-expanded={true}
          onClick={onCollapse}
          className="hover:bg-white/80"
        />
      </div>
      <DayRows view={view} dayKey={day} isToday={isToday} variant="expanded" {...actions} />
    </section>
  );
}

type TimelineStripProps = BarActions & { todayKey: string; timer: Timer };

/** Timeline strip in wide mode (1d): today only, no switcher or collapse, as in the design. */
export function TimelineStrip({ todayKey, timer, ...actions }: TimelineStripProps) {
  return (
    <section
      aria-label="Timeline"
      className="relative z-1 mx-2.5 mt-2 flex h-37.5 shrink-0 rounded-panel border border-white/85 bg-white/55 px-3 py-2 shadow-md backdrop-blur-glass"
    >
      <DayRows
        view={{ status: timer.status, sessions: timer.todaySessions, reload: timer.reload }}
        dayKey={todayKey}
        isToday
        variant="wide"
        {...actions}
      />
    </section>
  );
}
