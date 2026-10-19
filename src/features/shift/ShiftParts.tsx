import { Icon } from "../../components/Icon";
import { LiveDuration, type LiveTotal } from "../../components/LiveDuration";
import { fromLocalDayKey } from "../../lib/date";
import { formatTimeOfDay } from "../../lib/duration";
import type { Shift } from "../../lib/shift";

const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? "" : "s"}`;

/** "End shift" (7i): in the shift strip, and in the wide title bar. */
export function EndShiftButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-8 shrink-0 items-center gap-1.25 rounded-sm border border-white bg-white/85 px-2.5 text-ui-sm font-semibold whitespace-nowrap text-ink shadow-sm hover:bg-white"
    >
      <Icon name="bedtime" size={16} className="text-accent-ink" />
      End shift
    </button>
  );
}

/** "3 left over · Review" (7i): leftovers waiting after a shift started without Plan my day. */
export function LeftoversChip({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="target-32 flex h-7 shrink-0 items-center gap-1 rounded-tile bg-type-meeting/20 px-2 text-meta font-semibold whitespace-nowrap text-type-meeting-ink hover:bg-type-meeting/30"
    >
      <Icon name="history" size={14} />
      {count} left over · Review
    </button>
  );
}

type ShiftStripProps = {
  shift: Shift;
  total: LiveTotal;
  leftovers: number;
  onReview: () => void;
  onEndShift: () => void;
};

/** The shift strip above quick add (7i): when the shift started, time tracked, and End shift. */
export function ShiftStrip({ shift, total, leftovers, onReview, onEndShift }: ShiftStripProps) {
  return (
    <div className="relative z-1 mx-3 mb-2 flex min-h-10 shrink-0 items-center gap-1.5 rounded-md border border-white/80 bg-white/40 py-1 pr-1 pl-2.5">
      <span
        aria-hidden="true"
        className="size-2 shrink-0 rounded-full bg-status-success shadow-[0_0_0_3px] shadow-status-success/18"
      />
      <span className="min-w-0 flex-1 truncate text-caption text-ink-muted">
        {leftovers > 0 ? (
          `Since ${formatTimeOfDay(shift.startedAt)}`
        ) : (
          <>
            Shift since {formatTimeOfDay(shift.startedAt)} ·{" "}
            <span className="font-mono font-semibold text-ink">
              <LiveDuration {...total} />
            </span>
          </>
        )}
      </span>
      {leftovers > 0 && <LeftoversChip count={leftovers} onClick={onReview} />}
      <EndShiftButton onClick={onEndShift} />
    </div>
  );
}

type BetweenShiftsProps = {
  last: Shift;
  /** Seconds tracked in the last shift, or null while loading. */
  trackedSeconds: number | null;
  doneCount: number | null;
  leftovers: number;
  onStart: () => void;
  onReopen: () => void;
  className?: string;
};

/** The weekday a shift belongs to, from its day (a night shift keeps its evening's name). */
const weekday = (dayKey: string): string =>
  new Intl.DateTimeFormat("en-GB", { weekday: "long" }).format(fromLocalDayKey(dayKey));

/** Between shifts (7k): a clean Today with Start shift. Earlier days stay in the Log. */
export function BetweenShifts({
  last,
  trackedSeconds,
  doneCount,
  leftovers,
  onStart,
  onReopen,
  className = "",
}: BetweenShiftsProps) {
  const day = weekday(last.dayKey);
  return (
    <div
      className={`relative z-1 flex shrink-0 flex-col items-center gap-1.5 rounded-lg border border-white/85 bg-white/55 px-3.5 pt-3.5 pb-2.5 text-center shadow-sm backdrop-blur-glass ${className}`}
    >
      <span className="grid size-11 place-items-center rounded-md bg-accent/14 text-accent-ink">
        <Icon name="bedtime" size={24} />
      </span>
      <span className="mt-1 text-[17px] font-bold tracking-title">
        Shift ended{last.endedAt ? ` at ${formatTimeOfDay(last.endedAt)}` : ""}
      </span>
      <span className="text-ui-sm text-ink-muted">
        {day}
        {trackedSeconds !== null && (
          <>
            {" · "}
            <span className="font-mono font-semibold text-ink">
              <LiveDuration baseSeconds={trackedSeconds} runningSince={null} />
            </span>{" "}
            tracked
          </>
        )}
        {doneCount !== null && ` · ${plural(doneCount, "task")} done`}
      </span>
      <div className="mt-3 flex w-full flex-col gap-2">
        <button
          type="button"
          onClick={onStart}
          className="flex h-11 items-center justify-center gap-1.5 rounded-md bg-accent-gradient-strong text-body font-semibold text-white shadow-copy focus-visible:outline-offset-3"
        >
          <Icon name="wb_sunny" size={20} fill />
          Start shift
        </button>
        <button
          type="button"
          onClick={onReopen}
          className="h-8 rounded-sm text-ui-sm font-semibold text-accent-ink hover:bg-accent/12"
        >
          Reopen {day}’s shift
        </button>
      </div>
      {leftovers > 0 && (
        <span className="mt-1 flex items-center gap-1.25 text-meta text-ink-muted">
          <Icon name="history" size={14} />
          {plural(leftovers, "task")} left over · you’ll review them when you start
        </span>
      )}
    </div>
  );
}

/** The note for a shift Timi ended because it was left open (7l). */
export function ShiftNotice({
  shift,
  onDismiss,
  className = "",
}: {
  shift: Shift;
  onDismiss: () => void;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={`relative z-1 flex shrink-0 items-start gap-2 rounded-md border border-white bg-white/75 py-2.5 pr-2 pl-3 shadow-md ${className}`}
    >
      <Icon name="info" size={18} className="mt-px text-accent-ink" />
      <div className="flex flex-1 flex-col gap-0.5">
        <span className="text-ui-sm font-semibold">{weekday(shift.dayKey)}’s shift was ended for you</span>
        <span className="text-caption leading-[1.45] text-ink-muted">
          It ended at {shift.endedAt ? formatTimeOfDay(shift.endedAt) : "its last activity"}, when you last timed
          anything. Nothing after that was counted.
        </span>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="h-8 rounded-sm bg-accent/12 px-2.5 text-ui-sm font-semibold text-accent-ink hover:bg-accent/20"
      >
        OK
      </button>
    </div>
  );
}
