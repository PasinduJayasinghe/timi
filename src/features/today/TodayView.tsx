import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../../components/Icon";
import { useToast } from "../../components/Toast";
import { orderTasks, type TodayTasks } from "../../hooks/useTodayTasks";
import { TYPE_STYLES } from "../../lib/taskTypes";
import { FilterChips, type TaskFilter } from "./FilterChips";
import { QuickAddRow } from "./QuickAddRow";
import { TaskDetailsPopover } from "./TaskDetailsPopover";
import { TaskRow, type RowVariant } from "./TaskRow";
import { TodayEmpty } from "./TodayEmpty";

type TodayViewProps = {
  list: TodayTasks;
  variant: RowVariant;
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

/** Load error (drafted, in the 3c alert style). */
function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-md border border-status-error-edge/25 bg-status-error-surface/90 p-3"
    >
      <Icon name="sync_problem" size={20} className="text-status-error" />
      <div className="flex flex-1 flex-col gap-0.75">
        <span className="text-ui font-semibold">Couldn’t load your tasks</span>
        <span className="text-caption leading-[1.45] text-ink-muted">
          Your tasks are still saved on this PC. Try again, or restart Timi if this keeps happening.
        </span>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="flex h-8 items-center gap-1 rounded-sm border border-status-error-edge/30 bg-white px-3 text-caption font-semibold text-status-error hover:bg-status-error-surface"
      >
        <Icon name="refresh" size={16} />
        Retry
      </button>
    </div>
  );
}

type OpenDetails = { taskId: string; anchor: HTMLElement };

/** Today tab content: quick add, filter chips and the task list with its states. */
export function TodayView({ list, variant }: TodayViewProps) {
  const wide = variant === "wide";
  const toast = useToast();
  const [filter, setFilter] = useState<TaskFilter>("all");
  const [details, setDetails] = useState<OpenDetails | null>(null);
  const titleRefs = useRef(new Map<string, HTMLButtonElement>());

  // Drag preview: the order while dragging, before it is saved
  const [dragId, setDragId] = useState<string | null>(null);
  const [preview, setPreview] = useState<string[] | null>(null);

  const ordered = useMemo(() => orderTasks(list.tasks), [list.tasks]);
  const byId = useMemo(() => new Map(list.tasks.map((task) => [task.id, task])), [list.tasks]);
  const displayOrder = preview ? preview.flatMap((id) => byId.get(id) ?? []) : ordered;
  const visible = displayOrder.filter((task) => filter === "all" || task.type === filter);
  const showLoading = useDelayedFlag(list.status === "loading", LOADING_DELAY_MS);

  const detailsTask = details ? byId.get(details.taskId) : undefined;

  const closeDetails = (): void => {
    if (!details) return;
    const button = titleRefs.current.get(details.taskId);
    setDetails(null);
    button?.focus();
  };

  const remove = (id: string): void => {
    setDetails(null);
    const removed = list.remove(id);
    if (!removed) return;
    toast({
      message: "Task deleted",
      tone: "neutral",
      icon: "delete",
      action: {
        label: "Undo",
        onClick: () => {
          list.restore(removed);
        },
      },
    });
  };

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
        list.add(title, filter === "all" ? "other" : filter);
      }}
    />
  );

  const hasTasks = list.status === "ready" && list.tasks.length > 0;

  let body;
  if (list.status === "error") {
    body = (
      <div className={wide ? "" : "px-3 pt-2.5"}>
        <LoadError onRetry={list.reload} />
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
              titleRef={(element) => {
                if (element) titleRefs.current.set(task.id, element);
                else titleRefs.current.delete(task.id);
              }}
              onToggleDone={() => {
                list.toggleDone(task.id);
              }}
              onOpenDetails={(anchor) => {
                const row = anchor.closest<HTMLElement>("[data-task-row]") ?? anchor;
                setDetails((prev) => (prev?.taskId === task.id ? null : { taskId: task.id, anchor: row }));
              }}
              onMoveBy={(delta) => {
                moveBy(task.id, delta);
              }}
              onDragStart={() => {
                setDetails(null);
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
      {/* Portal: the wide-mode panes use backdrop-filter, which would trap a fixed-position popover */}
      {details &&
        detailsTask &&
        createPortal(
          <TaskDetailsPopover
            key={detailsTask.id}
            task={detailsTask}
            anchor={details.anchor}
            onClose={closeDetails}
            onUpdate={(patch, names) => {
              list.update(detailsTask.id, patch, names);
            }}
            onDelete={() => {
              remove(detailsTask.id);
            }}
          />,
          document.body,
        )}
    </>
  );
}
