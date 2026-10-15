import { useState, type DragEvent, type KeyboardEvent, type Ref } from "react";
import { Icon } from "../../components/Icon";
import type { Task } from "../../data/types";
import { formatMinutes } from "../../lib/estimate";
import { displayMeta, displayTitle } from "../../lib/taskDisplay";
import { TYPE_STYLES } from "../../lib/taskTypes";

export type RowVariant = "expanded" | "wide";

type TaskRowProps = {
  task: Task;
  variant: RowVariant;
  dragging: boolean;
  onToggleDone: () => void;
  onOpenDetails: (anchor: HTMLElement) => void;
  onMoveBy: (delta: -1 | 1) => void;
  onDragStart: () => void;
  onDragOver: () => void;
  onDragEnd: () => void;
  /** The title button, so focus can return to it when the popover closes. */
  titleRef?: Ref<HTMLButtonElement>;
};

/** Task row: 1a/1c in the expanded window, 1d compact row in wide mode. Timer controls arrive with Phase 2. */
export function TaskRow({
  task,
  variant,
  dragging,
  onToggleDone,
  onOpenDetails,
  onMoveBy,
  onDragStart,
  onDragOver,
  onDragEnd,
  titleRef,
}: TaskRowProps) {
  const [popping, setPopping] = useState(false);
  const style = TYPE_STYLES[task.type];
  const done = Boolean(task.completedAt);
  const carried = Boolean(task.carriedFrom) && !done;
  const showEstimate = task.estimateMinutes !== null && !done;
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

  const surface = done
    ? "border-white/85 bg-white/30 opacity-62"
    : wide
      ? "border-white/90 bg-white/60"
      : "border-white/85 bg-white/55 shadow-row hover:border-white hover:bg-white/85 hover:shadow-row-hover focus-within:border-white focus-within:bg-white/85 focus-within:shadow-row-hover";

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
        {done && <Icon name="check" size={wide ? 13 : 14} className="[font-variation-settings:'wght'_600]" />}
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

  const carriedTag = carried && (
    <span className="flex shrink-0 items-center gap-0.5 rounded-xs bg-ink-muted/10 py-px pr-1.5 pl-1 font-medium whitespace-nowrap text-type-other-ink">
      <Icon name="history" size={13} />
      from yesterday
    </span>
  );

  const playButton = !done && (
    <button
      type="button"
      aria-label="Start timer"
      title="Start timer"
      aria-disabled="true"
      className={`grid shrink-0 place-items-center rounded-full border-[1.5px] border-ink-muted/30 bg-transparent p-0 text-ink-muted hover:border-accent-ink hover:bg-white/70 hover:text-accent-ink ${
        wide ? "size-7.5" : "size-8"
      }`}
    >
      <Icon name="play_arrow" size={wide ? 17 : 18} fill />
    </button>
  );

  if (wide) {
    return (
      <div
        data-task-row
        {...dragHandlers}
        onKeyDown={onKeyDown}
        className={`flex h-11.5 shrink-0 items-center gap-2 rounded-md border px-2 transition-[opacity,background-color] duration-300 ${surface} ${
          dragging ? "opacity-45" : ""
        }`}
      >
        <span className="-mx-1.5 shrink-0">{check}</span>
        {tile}
        <button
          ref={titleRef}
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
        {carried && <span className="text-[11px]">{carriedTag}</span>}
        {playButton}
      </div>
    );
  }

  return (
    <div
      data-task-row
      {...dragHandlers}
      onKeyDown={onKeyDown}
      className={`group relative flex min-h-14 shrink-0 items-center gap-0.5 rounded-lg border py-1.5 pr-2 transition-[box-shadow,opacity,background-color] duration-300 ${surface} ${
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
        ref={titleRef}
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
          {carriedTag}
          {showEstimate && (
            <span className="shrink-0 font-mono text-duration whitespace-nowrap">
              est {formatMinutes(task.estimateMinutes ?? 0)}
            </span>
          )}
        </span>
      </button>
      {playButton}
    </div>
  );
}
