import { Icon } from "../../components/Icon";
import type { Task } from "../../data/types";
import { TASK_TYPES, TYPE_STYLES, type TaskType } from "../../lib/taskTypes";

export type TaskFilter = "all" | TaskType;

type FilterChipsProps = {
  tasks: readonly Task[];
  filter: TaskFilter;
  onChange: (filter: TaskFilter) => void;
  variant: "expanded" | "wide";
};

/** Filter by type (1a toolbar; 1d in wide mode). Counts include done tasks, as in the 1a script. */
export function FilterChips({ tasks, filter, onChange, variant }: FilterChipsProps) {
  const wide = variant === "wide";
  const items: Array<{ key: TaskFilter; short: string; label: string; icon?: string; count: number }> = [
    { key: "all", short: "All", label: "All tasks", count: tasks.length },
    ...TASK_TYPES.map((type) => ({
      key: type,
      short: TYPE_STYLES[type].short,
      label: TYPE_STYLES[type].label,
      icon: TYPE_STYLES[type].icon,
      count: tasks.filter((task) => task.type === type).length,
    })),
  ];

  return (
    <div role="toolbar" aria-label="Filter by type" className="flex gap-1.5">
      {items.map((item) => {
        const active = filter === item.key;
        const typeStyle = item.key === "all" ? null : TYPE_STYLES[item.key];
        let colours: string;
        if (active) colours = typeStyle ? typeStyle.chipActive : "border-ink bg-ink text-white";
        else if (wide) colours = `border-transparent ${typeStyle ? typeStyle.chipWide : "bg-white/50 text-ink"}`;
        else colours = `border-white/85 bg-white/50 hover:bg-white/75 ${typeStyle ? typeStyle.ink : "text-ink"}`;

        return (
          <button
            key={item.key}
            type="button"
            aria-pressed={active}
            aria-label={`${item.label}, ${item.count}`}
            title={item.label}
            onClick={() => {
              onChange(item.key);
            }}
            className={`flex items-center border text-caption font-semibold ${colours} ${
              wide ? "h-7 gap-1 rounded-tile px-2" : "h-8 min-w-8 gap-1.25 rounded-sm px-2.25"
            }`}
          >
            {item.icon && <Icon name={item.icon} size={wide ? 15 : 16} />}
            {(item.key === "all" || active) && <span>{item.short}</span>}
            <span className="font-mono text-duration font-medium opacity-85">{item.count}</span>
          </button>
        );
      })}
    </div>
  );
}
