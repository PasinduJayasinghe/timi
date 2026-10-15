import { useCallback, useMemo } from "react";
import type { ToastMessage } from "../components/Toast";
import type { Task } from "../data/types";
import { useTimer, type Timer } from "./useTimer";
import { useTodayTasks, type TaskDraft, type TodayTasks } from "./useTodayTasks";

export type Workday = {
  list: TodayTasks;
  timer: Timer;
  /** Starts a task's timer. A done task is reopened first, as in the 1a script. */
  startTask: (id: string) => void;
  /** Completing a running task stops its timer and saves the session. */
  toggleDone: (id: string) => void;
  /** Deleting a running task stops its timer first, so the worked time stays in the Log. */
  remove: (id: string) => Task | undefined;
  /** Adds a task from the Start task sheet and starts it. */
  startNew: (draft: TaskDraft) => void;
  /** Restarts a Recent task (2a): today's task itself, or a copy of a task from an earlier day. */
  replay: (task: Task) => void;
};

/** Today's tasks and the timer, with the actions that change both. */
export function useWorkday(
  day: string,
  carryOver: boolean | undefined,
  onSaveError: () => void,
  showToast: (toast: ToastMessage) => void,
  /** True while session sync is offline (Phase 6a). */
  syncOfflineRef?: { readonly current: boolean },
): Workday {
  const list = useTodayTasks(day, carryOver, onSaveError);
  const taskIds = useMemo(() => list.tasks.map((task) => task.id), [list.tasks]);
  const timer = useTimer(day, taskIds, onSaveError, showToast, syncOfflineRef);
  const { tasks, toggleDone: toggleListDone, remove: removeFromList, add } = list;
  const { running, start, pause } = timer;

  const startTask = useCallback(
    (id: string): void => {
      const task = tasks.find((t) => t.id === id);
      if (!task) return;
      if (task.completedAt) toggleListDone(id);
      start(task);
    },
    [start, tasks, toggleListDone],
  );

  const toggleDone = useCallback(
    (id: string): void => {
      if (running?.taskId === id) pause();
      toggleListDone(id);
    },
    [pause, running, toggleListDone],
  );

  const remove = useCallback(
    (id: string): Task | undefined => {
      if (running?.taskId === id) pause();
      return removeFromList(id);
    },
    [pause, removeFromList, running],
  );

  const startNew = useCallback(
    (draft: TaskDraft): void => {
      start(add(draft));
    },
    [add, start],
  );

  const replay = useCallback(
    (task: Task): void => {
      if (task.listDay === day && tasks.some((t) => t.id === task.id)) {
        startTask(task.id);
        return;
      }
      startNew({
        title: task.title,
        type: task.type,
        clientId: task.clientId,
        clientName: task.clientName,
        projectId: task.projectId,
        projectName: task.projectName,
        ticketNumber: task.ticketNumber,
      });
    },
    [day, startNew, startTask, tasks],
  );

  return { list, timer, startTask, toggleDone, remove, startNew, replay };
}
