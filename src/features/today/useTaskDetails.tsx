import { useCallback, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useToast } from "../../components/Toast";
import type { Workday } from "../../hooks/useWorkday";
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

/**
 * The task details popover (2d), shared by task rows and timeline bars. It is portalled to the
 * body because the wide-mode panes use backdrop-filter, which would trap a fixed-position popover.
 */
export function useTaskDetails(work: Workday, defaultReminderMinutes: number): TaskDetails {
  const toast = useToast();
  const [details, setDetails] = useState<OpenDetails | null>(null);
  const detailsRef = useRef(details);
  detailsRef.current = details;
  const task = details ? work.list.tasks.find((t) => t.id === details.taskId) : undefined;

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
    const removed = work.remove(id);
    if (!removed) return;
    toast({
      message: "Task deleted",
      tone: "neutral",
      icon: "delete",
      action: {
        label: "Undo",
        onClick: () => {
          work.list.restore(removed);
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
            onClose={close}
            onUpdate={(patch, names) => {
              work.list.update(task.id, patch, names);
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
