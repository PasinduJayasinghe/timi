import { useState } from "react";
import { Icon } from "../../components/Icon";
import { LiveDuration } from "../../components/LiveDuration";
import type { Session, Task } from "../../data/types";
import { fromLocalDayKey } from "../../lib/date";
import { formatDuration, formatTimeOfDay } from "../../lib/duration";
import { formatMinutes } from "../../lib/estimate";
import type { Shift } from "../../lib/shift";
import { totalSeconds } from "../../lib/sessionMath";
import { displayTitle, sessionDisplay } from "../../lib/taskDisplay";
import { styleOf } from "../../lib/taskTypes";
import { buildTimesheet } from "../../lib/timesheet";
import { SheetActions, ShiftSheet } from "./ShiftSheet";

type EndShiftSheetProps = {
  variant: "expanded" | "wide";
  shift: Shift;
  tasks: readonly Task[];
  sessions: readonly Session[];
  running: Session | null;
  trackedByTask: ReadonlyMap<string, number>;
  /** Plan my day is on: unfinished tasks wait for review instead of carrying over. */
  planMyDay: boolean;
  onEnd: () => void;
  onClose: () => void;
};

const weekday = (dayKey: string): string =>
  new Intl.DateTimeFormat("en-GB", { weekday: "long" }).format(fromLocalDayKey(dayKey));

/** End shift (7j): the shift's summary, a last Copy for timesheet, then End shift. */
export function EndShiftSheet({
  variant,
  shift,
  tasks,
  sessions,
  running,
  trackedByTask,
  planMyDay,
  onEnd,
  onClose,
}: EndShiftSheetProps) {
  const [copy, setCopy] = useState<"idle" | "copied" | "failed">("idle");
  const done = tasks.filter((task) => task.completedAt).length;
  const unfinished = tasks.filter((task) => !task.completedAt);
  const closed = sessions.filter((session) => session.endedAt !== null);
  const runningHere = running && sessions.some((session) => session.id === running.id) ? running : null;

  const copyTimesheet = (): void => {
    navigator.clipboard
      .writeText(buildTimesheet(sessions, Date.now()))
      .then(() => {
        setCopy("copied");
      })
      .catch((error: unknown) => {
        console.error("[shift] copy failed", error);
        setCopy("failed");
      });
  };

  const stats = [
    {
      label: "Tracked",
      value: (
        <LiveDuration baseSeconds={totalSeconds(closed, Date.now())} runningSince={runningHere?.startedAt ?? null} />
      ),
    },
    { label: "Done", value: `${done} of ${tasks.length}` },
    { label: "Sessions", value: String(sessions.length) },
  ];

  return (
    <ShiftSheet title="End shift" icon="bedtime" iconClass="text-accent-ink" variant={variant} onClose={onClose}>
      <span className="-mt-2.5 text-meta text-ink-muted">
        {weekday(shift.dayKey)} · {formatTimeOfDay(shift.startedAt)} – now
      </span>

      <div className="grid shrink-0 grid-cols-3 gap-2">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col gap-0.5 rounded-control border border-white bg-white/65 px-2.5 py-2"
          >
            <span className="text-label font-normal tracking-normal text-ink-muted">{stat.label}</span>
            <span className="font-mono text-[14px] font-semibold">{stat.value}</span>
          </div>
        ))}
      </div>

      {runningHere && (
        <div className="flex shrink-0 items-center gap-2 rounded-control bg-accent/12 px-2.5 py-2 text-caption text-accent-ink">
          <Icon name="timer" size={16} />
          <span className="flex-1 leading-[1.4]">
            <b className="font-semibold">{displayTitle(sessionDisplay(runningHere))}</b> is running. It stops when you
            end the shift.
          </span>
        </div>
      )}

      {unfinished.length > 0 && (
        <div className="flex shrink-0 flex-col rounded-md border border-white bg-white/65 px-3 pt-2 pb-2.5">
          <span className="flex h-6.5 items-center text-label text-ink-muted uppercase">
            Unfinished · {unfinished.length}
          </span>
          {unfinished.map((task) => {
            const style = styleOf(task);
            const tracked = trackedByTask.get(task.id) ?? 0;
            let meta = "—";
            if (tracked > 0) meta = formatDuration(tracked);
            else if (task.estimateMinutes !== null) meta = `est ${formatMinutes(task.estimateMinutes)}`;
            return (
              <div key={task.id} className="flex min-h-8.5 items-center gap-2">
                <span className={`grid size-6 shrink-0 place-items-center rounded-[7px] ${style.tint} ${style.ink}`}>
                  <Icon name={style.icon} size={14} />
                </span>
                <span className="min-w-0 flex-1 truncate text-ui-sm font-medium">{displayTitle(task)}</span>
                <span className="font-mono text-meta text-ink-muted">{meta}</span>
              </div>
            );
          })}
          <span className="mt-1 text-meta leading-[1.45] text-ink-muted">
            {planMyDay
              ? "They’re put aside. You’ll review them when your next shift starts."
              : "They carry over to your next shift."}
          </span>
        </div>
      )}

      <div className="flex shrink-0 flex-col gap-1">
        <button
          type="button"
          onClick={copyTimesheet}
          className={`flex h-10 items-center justify-center gap-1.5 rounded-md border border-white text-ui font-semibold ${
            copy === "copied" ? "bg-status-success text-white" : "bg-white/75 text-accent-ink hover:bg-white"
          }`}
        >
          <Icon name={copy === "copied" ? "check" : "content_copy"} size={18} />
          {copy === "copied" ? "Copied to clipboard" : "Copy for timesheet"}
        </button>
        {copy === "failed" && (
          <span role="alert" className="text-center text-meta text-status-error">
            Couldn’t copy to the clipboard. Try again.
          </span>
        )}
      </div>

      <SheetActions
        primary="End shift"
        primaryIcon="bedtime"
        onPrimary={onEnd}
        secondary="Cancel"
        onSecondary={onClose}
        autoFocus
      />
    </ShiftSheet>
  );
}
