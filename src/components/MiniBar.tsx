import type { MouseEvent } from "react";
import type { Session, Task } from "../data/types";
import { formatClock } from "../lib/duration";
import { displayMeta, displayTitle, sessionDisplay, type DisplayFields } from "../lib/taskDisplay";
import { TYPE_STYLES } from "../lib/taskTypes";
import { Icon } from "./Icon";
import { IconButton } from "./IconButton";
import { LiveDuration, type LiveTotal } from "./LiveDuration";
import { handleDragMouseDown, LogoMark } from "./TitleBar";

export type MiniBarState =
  | { kind: "running"; session: Session }
  /** The last task timed today, still open. */
  | { kind: "paused"; task: Task; trackedSeconds: number }
  | { kind: "idle" };

type MiniBarProps = {
  state: MiniBarState;
  /** Today's total, for the idle bar. */
  total: LiveTotal;
  onPause: () => void;
  onResume: (taskId: string) => void;
  /** Idle Start: expands the window and opens the Start task sheet. */
  onStart: () => void;
  onExpand: () => void;
};

/** Buttons inside the drag area must not start a window drag. */
const stopDrag = (event: MouseEvent): void => {
  event.stopPropagation();
};

function TypeTile({ task }: { task: DisplayFields }) {
  const style = TYPE_STYLES[task.type];
  return (
    <span
      title={style.label}
      className={`grid size-7.5 shrink-0 place-items-center rounded-tile ${style.tint} ${style.ink}`}
    >
      <Icon name={style.icon} size={17} />
    </span>
  );
}

/**
 * Collapsed mini bar (1e): running, paused and idle. The meeting variant and the " · next: …"
 * hint arrive with Phase 5. The design's 85% surface sits on the app gradient here, so the
 * desktop doesn't show through the transparent window.
 */
export function MiniBar({ state, total, onPause, onResume, onStart, onExpand }: MiniBarProps) {
  const expand = <IconButton icon="open_in_full" label="Expand" onClick={onExpand} onMouseDown={stopDrag} />;

  if (state.kind === "idle") {
    return (
      <div className="h-full w-full overflow-hidden rounded-panel bg-app">
        <div
          onMouseDown={handleDragMouseDown}
          className="flex h-full w-full cursor-grab items-center gap-2 rounded-panel border border-white/90 bg-mini/85 pr-2 pl-3.5 text-ink"
        >
          <LogoMark />
          <div className="flex min-w-0 flex-1 flex-col leading-[1.2]">
            <span className="truncate text-ui font-semibold">No timer running</span>
            <span className="text-duration text-ink-muted">
              Today{" "}
              <span className="font-mono">
                <LiveDuration {...total} />
              </span>
            </span>
          </div>
          <button
            type="button"
            onClick={onStart}
            onMouseDown={stopDrag}
            className="flex h-8 items-center gap-1 rounded-cta-sm pr-3 pl-2 text-caption font-semibold text-white bg-accent-gradient-strong hover:-translate-y-px"
          >
            <Icon name="play_arrow" size={18} fill />
            Start
          </button>
          {expand}
        </div>
      </div>
    );
  }

  const running = state.kind === "running";
  const task = running ? sessionDisplay(state.session) : state.task;
  const meta = running ? displayMeta(task) : `Paused · ${displayMeta(task)}`;

  return (
    <div className="h-full w-full overflow-hidden rounded-panel bg-app">
      <div
        onMouseDown={handleDragMouseDown}
        className={`flex h-full w-full cursor-grab items-center gap-2 rounded-panel pr-2 pl-2.5 text-ink ${
          running ? "border-[1.5px] border-transparent bg-running-mini" : "border border-white/90 bg-mini/85"
        }`}
      >
        <Icon name="drag_indicator" size={16} className="text-ink-muted/50" />
        <TypeTile task={task} />
        <div className="flex min-w-0 flex-1 flex-col leading-[1.2]">
          <span className="truncate text-ui font-semibold">{displayTitle(task)}</span>
          <span className="truncate text-duration text-ink-muted">{meta}</span>
        </div>
        {running ? (
          <>
            <span className="font-mono text-[15px] font-semibold text-accent-ink tabular-nums">
              <LiveDuration baseSeconds={0} runningSince={state.session.startedAt} format="clock" />
            </span>
            <button
              type="button"
              aria-label="Pause timer"
              title="Pause timer"
              onClick={onPause}
              onMouseDown={stopDrag}
              className="grid size-8 shrink-0 place-items-center rounded-full text-white bg-accent-gradient hover:scale-106"
            >
              <Icon name="pause" size={18} fill />
            </button>
          </>
        ) : (
          <>
            <span className="font-mono text-[15px] font-medium text-ink-muted tabular-nums">
              {formatClock(state.trackedSeconds)}
            </span>
            <button
              type="button"
              aria-label="Resume timer"
              title="Resume timer"
              onClick={() => {
                onResume(state.task.id);
              }}
              onMouseDown={stopDrag}
              className="grid size-8 shrink-0 place-items-center rounded-full border-[1.5px] border-accent-ink/45 bg-white text-accent-ink hover:bg-white/80"
            >
              <Icon name="play_arrow" size={18} fill />
            </button>
          </>
        )}
        {expand}
      </div>
    </div>
  );
}
