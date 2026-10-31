import { useState, type KeyboardEvent } from "react";
import { Icon } from "../../components/Icon";
import { TypeTile } from "../../components/TypeTile";
import type { CalendarEvent } from "../../data/calendar";
import type { Task } from "../../data/types";
import { orderTasks } from "../../hooks/useTodayTasks";
import { formatTimeOfDay } from "../../lib/duration";
import { formatMinutes, parseEstimate } from "../../lib/estimate";
import { minutesLeftForTasks } from "../../lib/shift";
import { displayTitle } from "../../lib/taskDisplay";
import { plural } from "../../lib/text";
import { SheetActions, ShiftSheet } from "./ShiftSheet";

type PlanMyDaySheetProps = {
  variant: "expanded" | "wide";
  todayKey: string;
  /** The shift's task list. */
  tasks: readonly Task[];
  /** The day's calendar events. */
  events: readonly CalendarEvent[];
  onAdd: (title: string) => void;
  onEstimate: (id: string, minutes: number | null) => void;
  onStart: () => void;
  onClose: () => void;
};

/**
 * Plan my day (7d), opened by Start shift: the shift's meetings and tasks, with estimates against
 * the hours left. Unfinished tasks from earlier shifts stay on their own day (Phase 12).
 */
export function PlanMyDaySheet({
  variant,
  todayKey,
  tasks,
  events,
  onAdd,
  onEstimate,
  onStart,
  onClose,
}: PlanMyDaySheetProps) {
  return (
    <ShiftSheet
      title="Plan my day"
      icon="wb_sunny"
      iconClass="text-type-meeting-ink"
      variant={variant}
      onClose={onClose}
    >
      <YourShift todayKey={todayKey} tasks={tasks} events={events} onAdd={onAdd} onEstimate={onEstimate} />
      <SheetActions
        primary="Start shift"
        primaryIcon="play_arrow"
        onPrimary={onStart}
        secondary="Cancel"
        onSecondary={onClose}
      />
      <span className="-mt-2 shrink-0 text-center text-duration text-ink-muted">
        Shown when you start a shift · turn off in Settings
      </span>
    </ShiftSheet>
  );
}

type YourShiftProps = Pick<PlanMyDaySheetProps, "todayKey" | "tasks" | "events" | "onAdd" | "onEstimate">;

/** Step 2: the shift's meetings, its tasks with estimates, and planned time against the hours left. */
function YourShift({ todayKey, tasks, events, onAdd, onEstimate }: YourShiftProps) {
  const [title, setTitle] = useState("");
  const now = Date.now();
  const meetings = events.filter((event) => event.endMs > now);
  const open = orderTasks(tasks).filter((task) => !task.completedAt);
  const leftMinutes = minutesLeftForTasks(todayKey, now, meetings);
  const plannedMinutes = open.reduce((sum, task) => sum + (task.estimateMinutes ?? 0), 0);
  const over = plannedMinutes - leftMinutes;
  const percent = leftMinutes > 0 ? Math.min(100, (plannedMinutes / leftMinutes) * 100) : plannedMinutes > 0 ? 100 : 0;

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const text = title.trim();
    if (!text) return;
    onAdd(text);
    setTitle("");
  };

  return (
    <>
      <div className="flex shrink-0 flex-col gap-0.5">
        <span className="text-[15px] font-bold">Your shift</span>
        <span className="text-ui-sm leading-[1.45] text-ink-muted">
          {meetings.length === 0 ? "No meetings." : `${plural(meetings.length, "meeting")}.`}{" "}
          {formatMinutes(Math.max(0, leftMinutes))} left for tasks.
        </span>
      </div>

      {meetings.map((event) => (
        <div
          key={event.id}
          className="flex h-10 shrink-0 items-center gap-2 rounded-control border border-type-calendar/35 bg-type-calendar/12 px-2.5"
        >
          <Icon name="videocam" size={15} className="text-type-calendar-ink" />
          <span className="min-w-0 flex-1 truncate text-ui-sm font-semibold">{event.title}</span>
          <span className="font-mono text-meta text-ink-muted">
            {formatTimeOfDay(new Date(event.startMs).toISOString())} –{" "}
            {formatTimeOfDay(new Date(event.endMs).toISOString())}
          </span>
        </div>
      ))}

      <div className="flex shrink-0 flex-col gap-0.5 rounded-md border border-white bg-white/65 px-3 pt-2 pb-3">
        <span className="flex h-7 items-center text-label text-ink-muted uppercase">Tasks · {open.length}</span>
        {open.map((task) => (
          <PlanRow key={task.id} task={task} onEstimate={onEstimate} />
        ))}
        <label className="mt-1 mb-2 flex h-9 items-center gap-1.5 rounded-control border border-ink-muted/18 bg-white px-2.5 focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-accent">
          <Icon name="add" size={16} className="text-accent-ink" />
          <input
            value={title}
            onChange={(event) => {
              setTitle(event.currentTarget.value);
            }}
            onKeyDown={onKeyDown}
            placeholder="Add a task, press Enter"
            aria-label="Add a task"
            data-autofocus
            className="min-w-0 flex-1 bg-transparent text-ui-sm text-ink placeholder:text-ink-placeholder focus-visible:outline-none"
          />
        </label>
        <div className="flex h-2 overflow-hidden rounded-[4px] bg-white/60">
          <span style={{ width: `${percent}%` }} className={over > 0 ? "bg-status-error-edge" : "bg-accent-gradient"} />
        </div>
        <span className={`mt-1 text-meta ${over > 0 ? "font-semibold text-status-error" : "text-ink-muted"}`}>
          {over > 0
            ? `Planned ${formatMinutes(plannedMinutes)} · ${formatMinutes(over)} more than you have`
            : `Planned ${plannedMinutes > 0 ? formatMinutes(plannedMinutes) : "0m"} of ${formatMinutes(
                Math.max(0, leftMinutes),
              )} · ${formatMinutes(Math.max(0, leftMinutes - plannedMinutes))} free`}
        </span>
      </div>
    </>
  );
}

function PlanRow({ task, onEstimate }: { task: Task; onEstimate: (id: string, minutes: number | null) => void }) {
  const [text, setText] = useState(task.estimateMinutes === null ? "" : formatMinutes(task.estimateMinutes));
  const [invalid, setInvalid] = useState(false);

  const save = (): void => {
    const minutes = parseEstimate(text);
    if (minutes === undefined) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setText(minutes === null ? "" : formatMinutes(minutes));
    if (minutes !== task.estimateMinutes) onEstimate(task.id, minutes);
  };

  return (
    <div className="flex min-h-9 items-center gap-2">
      <TypeTile task={task} />
      <span className="min-w-0 flex-1 truncate text-ui-sm font-medium">{displayTitle(task)}</span>
      {task.carriedFrom && (
        <span className="flex shrink-0 items-center gap-0.5 rounded-xs bg-ink-muted/10 py-px pr-1.5 pl-1 text-meta font-medium text-type-other-ink">
          <Icon name="history" size={13} />
          kept
        </span>
      )}
      <input
        value={text}
        onChange={(event) => {
          setText(event.currentTarget.value);
        }}
        onBlur={save}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        placeholder="est"
        aria-label={`Estimate for ${displayTitle(task)}`}
        aria-invalid={invalid}
        className={`h-8 w-16 shrink-0 rounded-xs bg-white/90 px-1.5 text-center font-mono text-meta font-medium placeholder:font-sans placeholder:text-accent-ink ${
          invalid ? "border-[1.5px] border-status-error-edge" : "border border-ink-muted/18"
        }`}
      />
    </div>
  );
}
