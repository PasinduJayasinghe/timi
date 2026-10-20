import { useState, type DragEvent } from "react";
import { Icon } from "../../components/Icon";
import { IconButton } from "../../components/IconButton";
import type { Task } from "../../data/types";
import type { ListStatus } from "../../hooks/useTodayTasks";
import { formatLongDate, fromLocalDayKey } from "../../lib/date";
import { formatMinutes } from "../../lib/estimate";
import { isOverPlanned } from "../../lib/plan";
import { displayTitle } from "../../lib/taskDisplay";
import { styleOf } from "../../lib/taskTypes";
import { WORK_SPAN_MIN } from "../../lib/timeline";
import { TASK_DRAG_TYPE } from "../today/TaskRow";

type WeekColumnsProps = {
  days: readonly string[];
  selectedKey: string;
  todayKey: string;
  status: ListStatus;
  /** Tasks listed on `days`. */
  tasks: readonly Task[];
  onSelect: (key: string) => void;
  /** Shows the days before or after (by the number of columns). */
  onShift: (direction: -1 | 1) => void;
  /** A task row dropped on a day (8b). */
  onMoveTask: (taskId: string, day: string) => void;
};

const SHOWN_TASKS = 4;

const isTaskDrag = (event: DragEvent): boolean => event.dataTransfer.types.includes(TASK_DRAG_TYPE);

/** The wide Plan's "This week" (7g): the coming days with load bars and first tasks. Drop a task on a day to move it. */
export function WeekColumns({
  days,
  selectedKey,
  todayKey,
  status,
  tasks,
  onSelect,
  onShift,
  onMoveTask,
}: WeekColumnsProps) {
  const [dropKey, setDropKey] = useState<string | null>(null);

  return (
    <section
      aria-label="This week"
      className="relative flex min-h-0 flex-col gap-2 overflow-hidden rounded-panel border border-white/80 bg-white/40 p-2.5 backdrop-blur-glass"
    >
      <div className="flex shrink-0 items-center gap-0.5">
        <h2 className="m-0 flex-1 text-ui-sm font-semibold">This week</h2>
        <span className="mr-1 text-duration text-ink-muted">Drop a task on a day to move it</span>
        <IconButton
          icon="chevron_left"
          label="Earlier days"
          onClick={() => {
            onShift(-1);
          }}
        />
        <IconButton
          icon="chevron_right"
          label="Later days"
          onClick={() => {
            onShift(1);
          }}
        />
      </div>
      <div className={`grid min-h-0 gap-1.5`} style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
        {days.map((key) => {
          const dayTasks = tasks.filter((task) => task.listDay === key);
          const minutes = dayTasks.reduce((sum, task) => sum + (task.estimateMinutes ?? 0), 0);
          const over = isOverPlanned(minutes);
          const selected = key === selectedKey;
          const past = key < todayKey;
          const date = fromLocalDayKey(key);
          let head = "hover:bg-white/70";
          if (selected) head = "text-white bg-accent-gradient-strong";
          else if (key === todayKey) head = "shadow-[inset_0_0_0_1.5px] shadow-accent-ink/35 hover:bg-white/70";
          return (
            <div
              key={key}
              onDragOver={(event) => {
                if (past || !isTaskDrag(event)) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setDropKey(key);
              }}
              onDragLeave={() => {
                setDropKey((current) => (current === key ? null : current));
              }}
              onDrop={(event) => {
                setDropKey(null);
                if (past || !isTaskDrag(event)) return;
                event.preventDefault();
                const id = event.dataTransfer.getData(TASK_DRAG_TYPE);
                if (id) onMoveTask(id, key);
              }}
              className={`flex min-w-0 flex-col gap-1.5 rounded-control p-1.5 transition-[background-color,box-shadow] duration-150 ${
                dropKey === key
                  ? "bg-accent/16 shadow-[inset_0_0_0_1.5px] shadow-accent"
                  : selected
                    ? "bg-white/70"
                    : "bg-white/40"
              }`}
            >
              <button
                type="button"
                aria-pressed={selected}
                aria-label={formatLongDate(key)}
                onClick={() => {
                  onSelect(key);
                }}
                className={`flex h-8.5 flex-col items-center justify-center rounded-tile leading-tight ${head}`}
              >
                <span className="text-micro font-semibold opacity-80">
                  {new Intl.DateTimeFormat("en-GB", { weekday: "short" }).format(date)}
                </span>
                <span className="text-ui-sm font-bold">{date.getDate()}</span>
              </button>
              {status !== "ready" ? (
                <span aria-busy={status === "loading"} className="h-8 rounded-tile bg-white/40" />
              ) : dayTasks.length === 0 ? (
                <span className="text-duration text-ink-muted">Nothing planned</span>
              ) : (
                <>
                  <div aria-hidden="true" className="h-1.25 overflow-hidden rounded-[3px] bg-white/70">
                    <div
                      style={{ width: `${Math.min(100, (minutes / WORK_SPAN_MIN) * 100)}%` }}
                      className={`h-full ${over ? "bg-status-error-edge" : "bg-accent-gradient"}`}
                    />
                  </div>
                  <span className={`font-mono text-[10px] ${over ? "text-status-error" : "text-ink-muted"}`}>
                    {minutes > 0 ? `${formatMinutes(minutes)}${over ? " · over" : ""}` : `${dayTasks.length} tasks`}
                  </span>
                  {dayTasks.slice(0, SHOWN_TASKS).map((task) => {
                    const style = styleOf(task);
                    return (
                      <span
                        key={task.id}
                        className={`flex min-w-0 items-center gap-1 text-duration ${task.completedAt ? "text-ink-muted line-through" : ""}`}
                      >
                        <Icon name={style.icon} size={13} className={style.ink} />
                        <span className="truncate">{displayTitle(task)}</span>
                      </span>
                    );
                  })}
                  {dayTasks.length > SHOWN_TASKS && (
                    <span className="text-duration text-ink-muted">+{dayTasks.length - SHOWN_TASKS} more</span>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
