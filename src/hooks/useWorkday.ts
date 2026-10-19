import { useCallback, useMemo } from "react";
import type { ToastMessage } from "../components/Toast";
import type { Task } from "../data/types";
import { useTimer, type Timer, type TimerTask } from "./useTimer";
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

/**
 * Today's tasks and the timer, with the actions that change both. `onActivity` runs before a task
 * is added or a timer starts, so doing either between shifts starts a shift (Phase 7).
 */
export function useWorkday(
  day: string,
  ready: boolean,
  onSaveError: () => void,
  showToast: (toast: ToastMessage) => void,
  onActivity: () => void,
  /** True while session sync is offline (Phase 6a). */
  syncOfflineRef?: { readonly current: boolean },
): Workday {
  const taskList = useTodayTasks(day, ready, onSaveError);
  const { add: addToList } = taskList;
  const addTask = useCallback(
    (draft: TaskDraft): Task => {
      onActivity();
      return addToList(draft);
    },
    [addToList, onActivity],
  );
  const taskIds = useMemo(() => taskList.tasks.map((task) => task.id), [taskList.tasks]);
  const timer = useTimer(day, taskIds, onSaveError, showToast, syncOfflineRef);
  const { tasks, toggleDone: toggleListDone, remove: removeFromList, moveToDay: moveInList } = taskList;
  const { running, start: startTimer, pause } = timer;
  // Moving a running task to another day stops its timer first, as delete does (7f)
  const moveToDay = useCallback(
    (id: string, to: string): Task | undefined => {
      if (running?.taskId === id) pause();
      return moveInList(id, to);
    },
    [moveInList, pause, running],
  );
  const list: TodayTasks = { ...taskList, add: addTask, moveToDay };
  const start = useCallback(
    (task: TimerTask): void => {
      onActivity();
      startTimer(task);
    },
    [onActivity, startTimer],
  );

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
      start(addTask(draft));
    },
    [addTask, start],
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

  // timer.start goes through onActivity too
  return { list, timer: { ...timer, start }, startTask, toggleDone, remove, startNew, replay };
}
