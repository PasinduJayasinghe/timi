import { Icon } from "../../components/Icon";
import { TypeTile } from "../../components/TypeTile";
import type { Task } from "../../data/types";
import { orderTasks } from "../../hooks/useTodayTasks";
import { formatDuration } from "../../lib/duration";
import { displayTitle } from "../../lib/taskDisplay";

type LogTasksProps = {
  tasks: readonly Task[];
  /** Seconds tracked per task on this day. */
  tracked: ReadonlyMap<string, number>;
  className?: string;
};

/**
 * The day's tasks in the Log (Phase 12), done or not. Unfinished tasks stay on their own day
 * instead of following you to the next shift, so this is where to find them.
 */
export function LogTasks({ tasks, tracked, className = "" }: LogTasksProps) {
  const ordered = orderTasks(tasks);
  const done = tasks.filter((task) => task.completedAt).length;
  return (
    <section
      aria-label="Tasks"
      className={`relative z-1 flex shrink-0 flex-col rounded-lg border border-white/85 bg-white/55 px-3 py-2 backdrop-blur-glass ${className}`}
    >
      <div className="flex h-6 items-center">
        <h2 className="m-0 flex-1 text-label text-ink-muted uppercase">Tasks · {tasks.length}</h2>
        <span className="font-mono text-meta text-ink-muted">
          {done} of {tasks.length} done
        </span>
      </div>
      <ul className="m-0 flex max-h-36 list-none flex-col overflow-y-auto p-0 [scrollbar-width:thin]">
        {ordered.map((task) => {
          const isDone = Boolean(task.completedAt);
          const seconds = tracked.get(task.id) ?? 0;
          return (
            <li key={task.id} className="flex min-h-8 items-center gap-2">
              {isDone ? (
                <span className="grid size-4.5 shrink-0 place-items-center rounded-full text-white bg-accent-gradient">
                  <Icon name="check" size={13} />
                </span>
              ) : (
                <span className="size-4.5 shrink-0 rounded-full border-[1.5px] border-ink-muted/45" />
              )}
              <TypeTile task={task} />
              <span
                className={`min-w-0 flex-1 truncate text-ui-sm font-medium ${isDone ? "text-ink-muted line-through" : ""}`}
              >
                {displayTitle(task)}
              </span>
              <span className="sr-only">{isDone ? "done" : "not done"}</span>
              <span className="font-mono text-meta text-ink-muted">{seconds > 0 ? formatDuration(seconds) : "—"}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
