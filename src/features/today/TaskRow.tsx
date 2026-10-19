import { useState, type DragEvent, type KeyboardEvent } from "react";
import { Icon } from "../../components/Icon";
import { LiveDuration } from "../../components/LiveDuration";
import type { Task } from "../../data/types";
import { formatClock, formatDuration, formatTimeOfDay } from "../../lib/duration";
import { formatMinutes } from "../../lib/estimate";
import { carriedLabel } from "../../lib/plan";
import type { PlanHint } from "../../lib/schedule";
import { displayMeta, displayTitle } from "../../lib/taskDisplay";
import { styleOf } from "../../lib/taskTypes";

export type RowVariant = "expanded" | "wide";

/** Drag data type carrying a task id, for drop targets outside the list (wide Plan, 8b). */
export const TASK_DRAG_TYPE = "application/x-timi-task";

/** This row's timer: the running session's start, or the time tracked so far. */
export type RowTimer = { kind: "running"; startedAt: string } | { kind: "stopped"; trackedSeconds: number };

type TaskRowProps = {
  task: Task;
  variant: RowVariant;
  dragging: boolean;
  timer: RowTimer;
  onPlay: () => void;
  onPause: () => void;
  onToggleDone: () => void;
  onOpenDetails: (anchor: HTMLElement) => void;
  onMoveBy: (delta: -1 | 1) => void;
  onDragStart: () => void;
  onDragOver: () => void;
  onDragEnd: () => void;
  /** False on another day's plan (7a): only today's tasks can be timed. */
  startable?: boolean;
  /** "planned 11 pm–12:30 am" or "not started · 7:30 pm" (7c). */
  planHint?: PlanHint | null;
};

/** Task row: 1a/1c in the expanded window, 1d compact row in wide mode. */
export function TaskRow({
  task,
  variant,
  dragging,
  timer,
  onPlay,
  onPause,
  onToggleDone,
  onOpenDetails,
  onMoveBy,
  onDragStart,
  onDragOver,
  onDragEnd,
  startable = true,
  planHint = null,
}: TaskRowProps) {
  const [popping, setPopping] = useState(false);
  const style = styleOf(task);
  const done = Boolean(task.completedAt);
  const running = timer.kind === "running";
  const tracked = timer.kind === "stopped" ? timer.trackedSeconds : 0;
  const paused = !running && !done && tracked > 0;
  const carried = Boolean(task.carriedFrom) && !done;
  const reminder = task.remindAt && !done ? task.remindAt : null;
  // 1a script: the estimate shows until the task has been timed
  const showEstimate = task.estimateMinutes !== null && !done && !running && tracked === 0;
  const wide = variant === "wide";

  const toggle = (): void => {
    setPopping(true);
    onToggleDone();
  };

  // Alt+Up / Alt+Down reorders from the keyboard (drag-and-drop alone isn't keyboard accessible)
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
    event.preventDefault();
    onMoveBy(event.key === "ArrowUp" ? -1 : 1);
  };

  const dragHandlers = {
    draggable: true,
    onDragStart: (event: DragEvent<HTMLDivElement>) => {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", task.id);
      // Lets the wide Plan's day columns accept task rows only (8b)
      event.dataTransfer.setData(TASK_DRAG_TYPE, task.id);
      onDragStart();
    },
    onDragOver: (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      onDragOver();
    },
    onDrop: (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
    },
    onDragEnd,
  };

  let surface: string;
  if (running) surface = "border-[1.5px] border-transparent bg-running shadow-running";
  else if (done) surface = "border border-white/85 bg-white/30 opacity-62";
  else if (wide) surface = "border border-white/90 bg-white/60";
  else
    surface =
      "border border-white/85 bg-white/55 shadow-row hover:border-white hover:bg-white/85 hover:shadow-row-hover focus-within:border-white focus-within:bg-white/85 focus-within:shadow-row-hover";

  const check = (
    <button
      type="button"
      onClick={toggle}
      aria-label={done ? "Mark as not done" : "Mark as done"}
      aria-pressed={done}
      className="grid size-8 shrink-0 place-items-center rounded-sm p-0 focus-visible:outline-offset-1"
    >
      <span
        onAnimationEnd={() => {
          setPopping(false);
        }}
        className={`grid place-items-center rounded-full ${wide ? "size-4.5" : "size-5"} ${
          done ? "bg-accent-gradient text-white" : "border-[1.5px] border-ink-muted/45 bg-white/60"
        } ${popping ? "animate-check-pop" : ""}`}
      >
        {done && <Icon name="check_bold" size={wide ? 13 : 14} />}
      </span>
    </button>
  );

  const tile = (
    <span
      title={style.label}
      className={`grid shrink-0 place-items-center ${style.tint} ${style.ink} ${
        wide ? "size-6.5 rounded-[8px]" : "mr-2 size-7 rounded-tile"
      }`}
    >
      <Icon name={style.icon} size={wide ? 16 : 17} />
    </span>
  );

  // 1c "Reminder due soon": bell and time, in the accent colour
  const reminderTag = reminder && (
    <span
      title={`Reminder ${new Date(reminder).toLocaleString()}`}
      className="flex shrink-0 items-center gap-0.5 rounded-xs bg-accent-ink/10 py-px pr-1.5 pl-1 font-semibold whitespace-nowrap text-accent-ink"
    >
      <Icon name="notifications" size={13} fill />
      {formatTimeOfDay(reminder)}
    </span>
  );

  const carriedTag = carried && (
    <span className="flex shrink-0 items-center gap-0.5 rounded-xs bg-ink-muted/10 py-px pr-1.5 pl-1 font-medium whitespace-nowrap text-type-other-ink">
      <Icon name="history" size={13} />
      {task.carriedFrom && carriedLabel(task.carriedFrom, task.listDay)}
    </span>
  );

  const planTag = planHint && (
    <span
      className={`flex shrink-0 items-center gap-0.5 rounded-xs py-px pr-1.5 pl-1 font-semibold whitespace-nowrap ${
        planHint.kind === "late" ? "bg-status-error-surface text-status-error" : "bg-type-internal/14 text-type-internal-ink"
      }`}
    >
      <Icon name="schedule" size={13} />
      {planHint.text}
    </span>
  );

  const buttonSize = wide ? "size-7.5" : "size-8";
  const buttonIcon = wide ? 17 : 18;

  // 1a/1c (1d in wide mode): running, paused, to do and done
  let controls = null;
  if (running) {
    controls = (
      <>
        <span
          className={`shrink-0 font-mono font-semibold text-accent-ink tabular-nums ${wide ? "text-ui" : "text-timer"}`}
        >
          <LiveDuration baseSeconds={0} runningSince={timer.startedAt} format="clock" />
        </span>
        <button
          type="button"
          onClick={onPause}
          aria-label="Pause timer"
          title="Pause timer"
          className={`grid shrink-0 place-items-center rounded-full p-0 text-white bg-accent-gradient focus-visible:outline-accent-ink ${buttonSize} ${
            wide ? "" : "shadow-pause hover:scale-106"
          }`}
        >
          <Icon name="pause" size={buttonIcon} fill />
        </button>
      </>
    );
  } else if (paused) {
    controls = (
      <>
        {wide ? (
          <span className="shrink-0 font-mono text-caption font-medium text-ink">{formatClock(tracked)}</span>
        ) : (
          <span className="flex shrink-0 flex-col items-end leading-[1.1]">
            <span className="font-mono text-ui font-medium text-ink">{formatClock(tracked)}</span>
            <span className="text-micro tracking-[0.05em] text-ink-muted">PAUSED</span>
          </span>
        )}
        <button
          type="button"
          onClick={onPlay}
          aria-label="Resume timer"
          title="Resume timer"
          className={`grid shrink-0 place-items-center rounded-full border-[1.5px] border-accent-ink/45 bg-white/70 p-0 text-accent-ink hover:bg-white ${buttonSize}`}
        >
          <Icon name="play_arrow" size={buttonIcon} fill />
        </button>
      </>
    );
  } else if (!done) {
    controls = (
      <button
        type="button"
        onClick={onPlay}
        disabled={!startable}
        aria-label="Start timer"
        title={startable ? "Start timer" : "Only today’s tasks can be timed"}
        className={`grid shrink-0 place-items-center rounded-full border-[1.5px] border-ink-muted/30 bg-transparent p-0 text-ink-muted enabled:hover:border-accent-ink enabled:hover:bg-white/70 enabled:hover:text-accent-ink disabled:cursor-default disabled:opacity-50 ${buttonSize}`}
      >
        <Icon name="play_arrow" size={buttonIcon} fill />
      </button>
    );
  } else if (tracked > 0) {
    controls = (
      <span className={`shrink-0 font-mono text-caption font-medium text-ink-muted ${wide ? "" : "pr-1"}`}>
        {formatDuration(tracked)}
      </span>
    );
  }

  if (wide) {
    return (
      <div
        data-task-row
        {...dragHandlers}
        onKeyDown={onKeyDown}
        className={`flex h-11.5 shrink-0 items-center gap-2 rounded-md px-2 transition-[opacity,background-color] duration-300 ${surface} ${
          dragging ? "opacity-45" : ""
        }`}
      >
        <span className="-mx-1.5 shrink-0">{check}</span>
        {tile}
        <button
          type="button"
          onClick={(event) => {
            onOpenDetails(event.currentTarget);
          }}
          aria-label={`Open details: ${displayTitle(task)}`}
          className={`min-w-0 flex-1 truncate rounded-xs text-left text-ui font-medium ${
            done ? "text-ink-muted line-through" : "text-ink"
          }`}
        >
          {displayTitle(task)}
          {/* 1d: done rows show the title only */}
          {!done && <span className="font-normal text-ink-muted"> · {displayMeta(task)}</span>}
        </button>
        {reminder && <span className="text-[11px]">{reminderTag}</span>}
        {carried && <span className="text-[11px]">{carriedTag}</span>}
        {planTag && <span className="text-[11px]">{planTag}</span>}
        {controls}
      </div>
    );
  }

  return (
    <div
      data-task-row
      {...dragHandlers}
      onKeyDown={onKeyDown}
      className={`group relative flex min-h-14 shrink-0 items-center gap-0.5 rounded-lg py-1.5 pr-2 transition-[box-shadow,opacity,background-color] duration-300 ${surface} ${
        dragging ? "opacity-45" : ""
      }`}
    >
      <span
        aria-hidden="true"
        title="Drag to reorder"
        className="w-4 cursor-grab text-center text-ink-muted/45 group-hover:text-ink-muted"
      >
        <Icon name="drag_indicator" size={16} />
      </span>
      {check}
      {tile}
      <button
        type="button"
        onClick={(event) => {
          onOpenDetails(event.currentTarget);
        }}
        aria-label={`Open details: ${displayTitle(task)}`}
        className="flex min-w-0 flex-1 flex-col gap-0.75 rounded-xs text-left"
      >
        <span
          className={`truncate text-body leading-[1.25] font-medium ${done ? "text-ink-muted line-through" : "text-ink"}`}
        >
          {displayTitle(task)}
        </span>
        <span className="flex min-w-0 items-center gap-1.5 text-meta leading-normal text-ink-muted">
          <span className="truncate">{displayMeta(task)}</span>
          {reminderTag}
          {carriedTag}
          {planTag}
          {showEstimate && (
            <span className="shrink-0 font-mono text-duration whitespace-nowrap">
              est {formatMinutes(task.estimateMinutes ?? 0)}
            </span>
          )}
        </span>
      </button>
      {controls && <span className="flex shrink-0 items-center gap-2">{controls}</span>}
    </div>
  );
}
