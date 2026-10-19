import { useCallback, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useToast } from "../../components/Toast";
import type { Task } from "../../data/types";
import type { TodayTasks } from "../../hooks/useTodayTasks";
import type { Workday } from "../../hooks/useWorkday";
import { formatShortDate, fromLocalDayKey } from "../../lib/date";
import { TaskDetailsPopover } from "./TaskDetailsPopover";

type OpenDetails = {
  taskId: string;
  /** What the popover points at: the task row or a timeline bar. */
  anchor: HTMLElement;
  /** Gets focus back when the popover closes. */
  opener: HTMLElement;
};

export type TaskDetails = {
  openTaskId: string | null;
  /** Opens the popover for a task, or closes it if it is already open for that task. */
  toggle: (taskId: string, anchor: HTMLElement, opener: HTMLElement) => void;
  close: () => void;
  /** The open popover, rendered in a portal; place it anywhere in the tree. */
  popover: ReactNode;
};

/** The list the popover edits: Today's (with the timer) or another day's on the Plan tab. */
export type TaskSource = Pick<TodayTasks, "tasks" | "update" | "restore" | "moveToDay" | "undoMove"> & {
  /** Deletes a task and returns it, for Undo. */
  remove: (id: string) => Task | undefined;
};

/** Today's list as a task source: deleting a running task stops its timer first. */
export function workdaySource(work: Workday): TaskSource {
  return { ...work.list, remove: work.remove };
}

/**
 * The task details popover (2d), shared by task rows and timeline bars. It is portalled to the
 * body because the wide-mode panes use backdrop-filter, which would trap a fixed-position popover.
 */
export function useTaskDetails(source: TaskSource, defaultReminderMinutes: number, todayKey: string): TaskDetails {
  const toast = useToast();
  const [details, setDetails] = useState<OpenDetails | null>(null);
  const detailsRef = useRef(details);
  detailsRef.current = details;
  const task = details ? source.tasks.find((t) => t.id === details.taskId) : undefined;

  const close = useCallback((): void => {
    const opener = detailsRef.current?.opener;
    setDetails(null);
    if (opener?.isConnected) opener.focus();
  }, []);

  const toggle = useCallback((taskId: string, anchor: HTMLElement, opener: HTMLElement): void => {
    setDetails((current) => (current?.taskId === taskId ? null : { taskId, anchor, opener }));
  }, []);

  const remove = (id: string): void => {
    setDetails(null);
    const removed = source.remove(id);
    if (!removed) return;
    toast({
      message: "Task deleted",
      tone: "neutral",
      icon: "delete",
      action: {
        label: "Undo",
        onClick: () => {
          source.restore(removed);
        },
      },
    });
  };

  // Moving a task to another day takes it off this list (7f), so the popover closes
  const moveToDay = (id: string, day: string): void => {
    const moved = source.moveToDay(id, day);
    if (!moved) return;
    close();
    toast({
      message: `Moved to ${formatShortDate(fromLocalDayKey(day))}`,
      tone: "neutral",
      icon: "calendar_today",
      action: {
        label: "Undo",
        onClick: () => {
          source.undoMove(moved);
        },
      },
    });
  };

  const popover =
    details && task
      ? createPortal(
          <TaskDetailsPopover
            key={task.id}
            task={task}
            anchor={details.anchor}
            defaultReminderMinutes={defaultReminderMinutes}
            todayKey={todayKey}
            onClose={close}
            onUpdate={(patch, names) => {
              source.update(task.id, patch, names);
            }}
            onMoveToDay={(day) => {
              moveToDay(task.id, day);
            }}
            onDelete={() => {
              remove(task.id);
            }}
          />,
          document.body,
        )
      : null;

  return { openTaskId: task ? task.id : null, toggle, close, popover };
}
