import { useState } from "react";
import { Icon } from "../../components/Icon";
import { useCalendarEvents, type CalendarState } from "../../hooks/useCalendar";
import { useDaySessions, useSessionsForDays } from "../../hooks/useDaySessions";
import type { Timer } from "../../hooks/useTimer";
import { weekStartKey } from "../../lib/calendar";
import { addDays, dayStartOf, fromLocalDayKey, workDayKey, workDayRange } from "../../lib/date";
import { CalendarEmpty } from "./CalendarEmpty";
import { MonthPicker, WeekStrip } from "./DatePickers";
import { DayView } from "./DayView";
import { AccountChip, SyncProblemAlert } from "./parts";
import { WeekView } from "./WeekView";

type CalendarViewProps = {
  calendar: CalendarState;
  todayKey: string;
  /** Today's sessions come from the timer, so the running one stays live. */
  timer: Timer;
};

type View = "day" | "week";

/** "6 – 12 October", or "29 Sept – 5 Oct" across months (3b). */
function weekLabel(startKey: string): string {
  const start = fromLocalDayKey(startKey);
  const end = fromLocalDayKey(addDays(startKey, 6));
  const month = (date: Date): string => new Intl.DateTimeFormat("en-GB", { month: "long" }).format(date);
  const shortMonth = (date: Date): string => new Intl.DateTimeFormat("en-GB", { month: "short" }).format(date);
  if (start.getMonth() === end.getMonth()) return `${start.getDate()} – ${end.getDate()} ${month(end)}`;
  return `${start.getDate()} ${shortMonth(start)} – ${end.getDate()} ${shortMonth(end)}`;
}

function ViewSwitch({ view, onChange }: { view: View; onChange: (view: View) => void }) {
  return (
    <div
      role="radiogroup"
      aria-label="Calendar view"
      className="flex rounded-[11px] border border-white/80 bg-white/45 p-0.75"
    >
      {(["day", "week"] as const).map((option) => {
        const active = option === view;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => {
              onChange(option);
            }}
            className={`target-32 h-7 rounded-[8px] px-3.5 text-caption ${
              active ? "bg-white font-semibold shadow-sm" : "font-medium text-ink-muted hover:text-ink"
            }`}
          >
            {option === "day" ? "Day" : "Week"}
          </button>
        );
      })}
    </div>
  );
}

/** Calendar tab (3a day view, 3b week view and month picker, 3c states). */
export function CalendarView({ calendar, todayKey, timer }: CalendarViewProps) {
  const { status } = calendar;
  const [day, setDay] = useState(todayKey);
  const [view, setView] = useState<View>("day");
  const [monthOpen, setMonthOpen] = useState(false);

  const weekStart = weekStartKey(day);
  const weekStartMs = dayStartOf(weekStart).getTime();
  const weekEndMs = dayStartOf(addDays(weekStart, 7)).getTime();
  const events = useCalendarEvents(calendar, weekStartMs, weekEndMs);

  const isToday = day === todayKey;
  const past = useDaySessions(view === "day" && day < todayKey ? day : null);
  const week = useSessionsForDays(view === "week" ? weekStart : null, view === "week" ? addDays(weekStart, 7) : null);

  if (!status) return <div aria-busy="true" aria-label="Loading calendar" className="flex-1" />;
  if (!status.connected) return <CalendarEmpty calendar={calendar} className="flex-1 p-7" />;

  const range = workDayRange(day);
  const dayStart = Date.parse(range.start);
  const dayEnd = Date.parse(range.end);
  const dayEvents = events.events.filter((event) => event.endMs > dayStart && event.startMs < dayEnd);
  const daySessions = isToday ? timer.todaySessions : day < todayKey ? past.sessions : [];
  // The week's sessions, with today's live ones from the timer
  const weekSessions = [
    ...week.sessions.filter((session) => session.dayKey !== todayKey),
    ...timer.todaySessions,
  ];
  const eventDays = new Set(events.events.map((event) => workDayKey(new Date(event.startMs))));

  const pick = (key: string): void => {
    setDay(key);
    setMonthOpen(false);
  };
  const monthPicker = (position?: string) =>
    monthOpen && (
      <MonthPicker
        selectedKey={day}
        todayKey={todayKey}
        position={position}
        onSelect={pick}
        onClose={() => {
          setMonthOpen(false);
        }}
      />
    );
  const alert = <SyncProblemAlert status={status} onRetry={calendar.retry} onReconnect={calendar.connect} />;

  if (view === "week") {
    return (
      <div className="relative z-1 flex min-h-0 flex-1 flex-col">
        <div className="relative flex shrink-0 items-center gap-1.5 px-3 pb-2.5">
          <span className="relative flex-1">
            <button
              type="button"
              aria-expanded={monthOpen}
              aria-haspopup="dialog"
              onClick={() => {
                setMonthOpen(!monthOpen);
              }}
              className="flex h-8 items-center gap-0.5 rounded-sm pl-1 text-ui font-semibold hover:bg-white/60"
            >
              {weekLabel(weekStart)}
              <Icon name={monthOpen ? "expand_less" : "expand_more"} size={18} className="text-accent-ink" />
            </button>
            {monthPicker()}
          </span>
          <ViewSwitch view={view} onChange={setView} />
        </div>
        {status.problem && <div className="shrink-0 px-3 pb-2.5">{alert}</div>}
        <WeekView
          dayKey={day}
          todayKey={todayKey}
          sessions={weekSessions}
          events={events.events}
          onOpenDay={(key) => {
            setDay(key);
            setView("day");
          }}
        />
      </div>
    );
  }

  return (
    <div className="relative z-1 flex min-h-0 flex-1 flex-col">
      <div className="relative shrink-0">
        <WeekStrip
          selectedKey={day}
          todayKey={todayKey}
          eventDays={eventDays}
          monthOpen={monthOpen}
          onSelect={pick}
          onToggleMonth={() => {
            setMonthOpen(!monthOpen);
          }}
        />
        {monthPicker("top-11 left-3")}
      </div>
      <div className="flex shrink-0 items-center gap-2 px-3 pt-2.5 pb-1.5">
        <ViewSwitch view={view} onChange={setView} />
        <span className="flex-1" />
        <AccountChip status={status} />
      </div>
      {status.problem && <div className="shrink-0 px-3 pb-2">{alert}</div>}
      <DayView dayKey={day} isToday={isToday} sessions={daySessions} events={dayEvents} />
    </div>
  );
}
