import { useRef, type KeyboardEvent } from "react";

export type TabItem<T extends string> = {
  id: T;
  label: string;
};

type TabsProps<T extends string> = {
  items: readonly TabItem<T>[];
  selected: T;
  onSelect: (id: T) => void;
  label: string;
  /** "main" is the 3-column tab list (1a); "compact" is the wide-mode switcher (1d). */
  variant?: "main" | "compact";
  className?: string;
};

export function tabId(id: string): string {
  return `tab-${id}`;
}

export function panelId(id: string): string {
  return `panel-${id}`;
}

const LIST_CLASS = {
  main: "grid flex-1 grid-cols-3 rounded-tablist p-0.75 backdrop-blur-control",
  compact: "flex rounded-control p-0.75",
} as const;

const TAB_CLASS = {
  main: "h-8 rounded-sm text-ui",
  compact: "h-7 rounded-tile px-3.5 text-ui-sm",
} as const;

/** ARIA tab list with roving focus: arrow keys, Home and End move and select. */
export function Tabs<T extends string>({
  items,
  selected,
  onSelect,
  label,
  variant = "main",
  className = "",
}: TabsProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const current = items.findIndex((item) => item.id === selected);
    let next = current;
    if (event.key === "ArrowRight") next = (current + 1) % items.length;
    else if (event.key === "ArrowLeft") next = (current - 1 + items.length) % items.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = items.length - 1;
    else return;
    event.preventDefault();
    onSelect(items[next].id);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={`border border-white/80 bg-white/45 ${LIST_CLASS[variant]} ${className}`}
    >
      {items.map((item, index) => {
        const isSelected = item.id === selected;
        return (
          <button
            key={item.id}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="tab"
            id={tabId(item.id)}
            aria-selected={isSelected}
            aria-controls={panelId(item.id)}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => {
              onSelect(item.id);
            }}
            className={`grid place-items-center ${TAB_CLASS[variant]} ${
              isSelected
                ? "bg-white font-semibold text-ink shadow-sm"
                : "font-medium text-ink-muted hover:bg-white/60 hover:text-ink"
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
