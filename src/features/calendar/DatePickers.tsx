import { useEffect, useRef, useState } from "react";
import { Icon } from "../../components/Icon";
import { IconButton } from "../../components/IconButton";
import { weekStartKey } from "../../lib/calendar";
import { addDays, fromLocalDayKey, toLocalDayKey } from "../../lib/date";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"] as const;

const monthLabel = (key: string): string =>
  new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(fromLocalDayKey(key));

const dayNumber = (key: string): number => fromLocalDayKey(key).getDate();

/** The seven days (Monday first) of the week a day falls in. */
export function weekDays(dayKey: string): string[] {
  const monday = weekStartKey(dayKey);
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

type WeekStripProps = {
  selectedKey: string;
  todayKey: string;
  /** Days with calendar events get a rose dot (3a). */
  eventDays: ReadonlySet<string>;
  monthOpen: boolean;
  onSelect: (key: string) => void;
  onToggleMonth: () => void;
};

/** Week strip at the top of the Calendar tab (3a): month name opens the month picker. */
export function WeekStrip({ selectedKey, todayKey, eventDays, monthOpen, onSelect, onToggleMonth }: WeekStripProps) {
  const days = weekDays(selectedKey);
  return (
    <div className="relative z-1 mx-3 flex shrink-0 flex-col gap-1.5 rounded-lg border border-white/85 bg-white/55 px-2 pt-2 pb-2.5 backdrop-blur-glass">
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          aria-expanded={monthOpen}
          aria-haspopup="dialog"
          onClick={onToggleMonth}
          className="flex h-8 flex-1 items-center gap-0.5 rounded-sm pl-1.5 text-left text-ui font-semibold hover:bg-white/60"
        >
          {monthLabel(selectedKey)}
          <Icon name={monthOpen ? "expand_less" : "expand_more"} size={18} className="text-ink-muted" />
        </button>
        <IconButton
          icon="chevron_left"
          label="Previous week"
          onClick={() => {
            onSelect(addDays(selectedKey, -7));
          }}
        />
        <IconButton
          icon="chevron_right"
          label="Next week"
          onClick={() => {
            onSelect(addDays(selectedKey, 7));
          }}
        />
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {WEEKDAYS.map((letter, index) => (
          <span key={index} aria-hidden="true" className="text-label text-ink-muted">
            {letter}
          </span>
        ))}
        {days.map((key) => {
          const selected = key === selectedKey;
          const future = key > todayKey;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={selected}
              aria-label={new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" }).format(
                fromLocalDayKey(key),
              )}
              onClick={() => {
                onSelect(key);
              }}
              className={`flex h-8.5 flex-col items-center justify-center gap-0.5 rounded-sm text-ui ${
                selected
                  ? "font-bold text-white bg-accent-gradient-strong"
                  : `font-medium hover:bg-white/70 ${future ? "text-ink-muted" : "text-ink"}`
              }`}
            >
              {dayNumber(key)}
              <span
                aria-hidden="true"
                className={`size-1 rounded-full ${eventDays.has(key) ? (selected ? "bg-white" : "bg-type-calendar") : ""}`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

type MonthPickerProps = {
  selectedKey: string;
  todayKey: string;
  onSelect: (key: string) => void;
  onClose: () => void;
  /** Where it opens; it must share a parent with the button that toggles it. */
  position?: string;
};

/** Month picker (3b): the selected week is banded, the selected day filled; "Today" jumps back. */
export function MonthPicker({
  selectedKey,
  todayKey,
  onSelect,
  onClose,
  position = "top-full left-0 mt-1",
}: MonthPickerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const selected = fromLocalDayKey(selectedKey);
  const [month, setMonth] = useState({ year: selected.getFullYear(), month: selected.getMonth() });

  useEffect(() => {
    const onPointerDown = (event: PointerEvent): void => {
      const area = ref.current?.parentElement ?? ref.current;
      if (area && !area.contains(event.target as Node)) onClose();
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const firstKey = toLocalDayKey(new Date(month.year, month.month, 1));
  const gridStart = weekStartKey(firstKey);
  const lastKey = toLocalDayKey(new Date(month.year, month.month + 1, 0));
  const weeks: string[][] = [];
  for (let start = gridStart; start <= lastKey; start = addDays(start, 7)) weeks.push(weekDays(start));
  const selectedWeek = weekStartKey(selectedKey);
  const step = (delta: number): void => {
    setMonth(({ year, month: m }) => {
      const date = new Date(year, m + delta, 1);
      return { year: date.getFullYear(), month: date.getMonth() };
    });
  };

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Choose a day"
      className={`absolute z-30 w-62.5 rounded-lg border border-white bg-white/97 p-2.5 shadow-month ${position}`}
    >
      <div className="mb-1.5 flex items-center">
        <span className="flex-1 pl-1 text-ui-sm font-semibold">{monthLabel(firstKey)}</span>
        <IconButton
          icon="chevron_left"
          label="Previous month"
          onClick={() => {
            step(-1);
          }}
        />
        <IconButton
          icon="chevron_right"
          label="Next month"
          onClick={() => {
            step(1);
          }}
        />
      </div>
      <div className="grid grid-cols-[repeat(7,32px)] gap-px text-center text-caption leading-8">
        {WEEKDAYS.map((letter, index) => (
          <span key={index} aria-hidden="true" className="text-micro text-ink-muted">
            {letter}
          </span>
        ))}
        {weeks.flatMap((week) =>
          week.map((key, index) => {
            const inMonth = fromLocalDayKey(key).getMonth() === month.month;
            const isSelected = key === selectedKey;
            const inSelectedWeek = weekStartKey(key) === selectedWeek;
            let band = "";
            if (inSelectedWeek && !isSelected) {
              band = `bg-accent/12 ${index === 0 ? "rounded-l-[8px]" : ""} ${index === 6 ? "rounded-r-[8px]" : ""}`;
            }
            return (
              <button
                key={key}
                type="button"
                aria-pressed={isSelected}
                aria-current={key === todayKey ? "date" : undefined}
                onClick={() => {
                  onSelect(key);
                }}
                className={`size-8 ${band} ${
                  isSelected
                    ? "rounded-[8px] font-bold text-white bg-accent-gradient-strong"
                    : `rounded-[8px] hover:bg-accent/20 ${inMonth ? "text-ink" : "text-ink-disabled"}`
                }`}
              >
                {dayNumber(key)}
              </button>
            );
          }),
        )}
      </div>
      <div className="mt-1.5 flex justify-end">
        <button
          type="button"
          onClick={() => {
            onSelect(todayKey);
          }}
          className="h-8 rounded-tile bg-accent/12 px-2.5 text-caption font-semibold text-accent-ink hover:bg-accent/20"
        >
          Today
        </button>
      </div>
    </div>
  );
}
