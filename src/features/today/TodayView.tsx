import { useEffect, useMemo, useState } from "react";
import { LoadError } from "../../components/LoadError";
import { orderTasks } from "../../hooks/useTodayTasks";
import type { Workday } from "../../hooks/useWorkday";
import { TYPE_STYLES } from "../../lib/taskTypes";
import { FilterChips, type TaskFilter } from "./FilterChips";
import { QuickAddRow } from "./QuickAddRow";
import { TaskRow, type RowTimer, type RowVariant } from "./TaskRow";
import { TodayEmpty } from "./TodayEmpty";
import type { TaskDetails } from "./useTaskDetails";

type TodayViewProps = {
  work: Workday;
  variant: RowVariant;
  /** Opens the Start task sheet (2a). */
  onStartTask: () => void;
  /** The task details popover, shared with the timeline. */
  details: TaskDetails;
  /** Focuses quick add each time it changes (global quick add). */
  focusQuickAdd?: number;
};

/** Loading rows appear only if loading takes longer than this, to avoid a flash. */
const LOADING_DELAY_MS = 200;

function useDelayedFlag(active: boolean, delay: number): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!active) {
      setShown(false);
      return;
    }
    const timeoutId = window.setTimeout(() => {
      setShown(true);
    }, delay);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [active, delay]);
  return shown;
}

/** Today tab content: quick add, filter chips and the task list with its states. */
export function TodayView({ work, variant, onStartTask, details, focusQuickAdd }: TodayViewProps) {
  const { list, timer } = work;
  const wide = variant === "wide";
  const [filter, setFilter] = useState<TaskFilter>("all");

  // Drag preview: the order while dragging, before it is saved
  const [dragId, setDragId] = useState<string | null>(null);
  const [preview, setPreview] = useState<string[] | null>(null);

  const ordered = useMemo(() => orderTasks(list.tasks), [list.tasks]);
  const byId = useMemo(() => new Map(list.tasks.map((task) => [task.id, task])), [list.tasks]);
  const displayOrder = preview ? preview.flatMap((id) => byId.get(id) ?? []) : ordered;
  const visible = displayOrder.filter((task) => filter === "all" || task.type === filter);
  const showLoading = useDelayedFlag(list.status === "loading", LOADING_DELAY_MS);

  /** Keyboard reorder: swap with the next visible task in the same group. */
  const moveBy = (id: string, delta: -1 | 1): void => {
    const task = byId.get(id);
    if (!task) return;
    const group = ordered.filter((t) => Boolean(t.completedAt) === Boolean(task.completedAt));
    const visibleGroup = group.filter((t) => filter === "all" || t.type === filter);
    const neighbour = visibleGroup[visibleGroup.findIndex((t) => t.id === id) + delta];
    if (!neighbour) return;
    list.moveTo(
      id,
      group.findIndex((t) => t.id === neighbour.id),
    );
  };

  const onDragOver = (overId: string): void => {
    if (!dragId || !preview || overId === dragId) return;
    const dragged = byId.get(dragId);
    const over = byId.get(overId);
    // Open and done tasks stay in their own groups
    if (!dragged || !over || Boolean(dragged.completedAt) !== Boolean(over.completedAt)) return;
    const next = preview.filter((id) => id !== dragId);
    next.splice(preview.indexOf(overId), 0, dragId);
    setPreview(next);
  };

  const onDragEnd = (): void => {
    const id = dragId;
    const order = preview;
    setDragId(null);
    setPreview(null);
    if (!id || !order) return;
    const dragged = byId.get(id);
    if (!dragged) return;
    const group = order.filter((other) => Boolean(byId.get(other)?.completedAt) === Boolean(dragged.completedAt));
    list.moveTo(id, group.indexOf(id));
  };

  const quickAdd = (
    <QuickAddRow
      variant={variant}
      autoFocus
      onAdd={(title) => {
        list.add({ title, type: filter === "all" ? "other" : filter });
      }}
      onStartTask={onStartTask}
      focusSignal={focusQuickAdd}
    />
  );

  const rowTimer = (taskId: string): RowTimer =>
    timer.running?.taskId === taskId
      ? { kind: "running", startedAt: timer.running.startedAt }
      : { kind: "stopped", trackedSeconds: timer.trackedByTask.get(taskId) ?? 0 };

  const hasTasks = list.status === "ready" && list.tasks.length > 0;

  let body;
  if (list.status === "error") {
    body = (
      <div className={wide ? "" : "px-3 pt-2.5"}>
        <LoadError title="Couldn’t load your tasks" subject="tasks" onRetry={list.reload} />
      </div>
    );
  } else if (list.status === "loading") {
    body = (
      <div aria-busy="true" aria-label="Loading tasks" className={`flex flex-col gap-1.5 ${wide ? "" : "px-2.5 pt-3.5"}`}>
        {showLoading &&
          [0, 1, 2].map((index) => (
            <div key={index} className={`rounded-lg bg-white/40 ${wide ? "h-11.5 rounded-md" : "h-14"}`} />
          ))}
      </div>
    );
  } else if (!hasTasks) {
    body = <TodayEmpty className={`flex-1 ${wide ? "px-8" : "px-10"}`} />;
  } else {
    body = (
      <>
        <div className={wide ? "" : "relative z-1 shrink-0 px-3 pt-2.5 pb-1"}>
          <FilterChips tasks={list.tasks} filter={filter} onChange={setFilter} variant={variant} />
        </div>
        <div
          className={`relative z-1 flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto [scrollbar-width:thin] ${
            wide ? "gap-1.25" : "gap-1.5 px-2.5 pt-1 pb-2"
          }`}
        >
          {visible.length === 0 && filter !== "all" && (
            <p className="m-0 flex flex-1 items-center justify-center px-6 text-center text-meta text-ink-muted">
              No {TYPE_STYLES[filter].label.toLowerCase()} tasks today. Add one above.
            </p>
          )}
          {visible.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              variant={variant}
              dragging={dragId === task.id}
              timer={rowTimer(task.id)}
              onPlay={() => {
                work.startTask(task.id);
              }}
              onPause={timer.pause}
              onToggleDone={() => {
                work.toggleDone(task.id);
              }}
              onOpenDetails={(opener) => {
                const row = opener.closest<HTMLElement>("[data-task-row]") ?? opener;
                details.toggle(task.id, row, opener);
              }}
              onMoveBy={(delta) => {
                moveBy(task.id, delta);
              }}
              onDragStart={() => {
                details.close();
                setDragId(task.id);
                setPreview(ordered.map((t) => t.id));
              }}
              onDragOver={() => {
                onDragOver(task.id);
              }}
              onDragEnd={onDragEnd}
            />
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <div className={wide ? "" : "relative z-1 shrink-0 px-3"}>{quickAdd}</div>
      {body}
    </>
  );
}
