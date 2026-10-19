import { useState } from "react";
import { useToast } from "../../components/Toast";
import { useCalendarEvents, type CalendarState } from "../../hooks/useCalendar";
import { useDayPlan } from "../../hooks/useDayPlan";
import { useDayRangeTasks } from "../../hooks/useDayRangeTasks";
import { useDaySummary } from "../../hooks/useLeftovers";
import { useTodayTasks } from "../../hooks/useTodayTasks";
import { useWeekSummary } from "../../hooks/useWeekSummary";
import type { Workday } from "../../hooks/useWorkday";
import { weekStartKey } from "../../lib/calendar";
import { addDays, formatShortDate, fromLocalDayKey, workDayRange } from "../../lib/date";
import { dayLoad, isOverPlanned, weekCellLabel } from "../../lib/plan";
import { WORK_SPAN_MIN, WORK_START_MIN } from "../../lib/timeline";
import { MonthPicker, WeekStrip } from "../calendar/DatePickers";
import { TodayView } from "../today/TodayView";
import { useTaskDetails, type TaskDetails } from "../today/useTaskDetails";
import { GoalsCard } from "./GoalsCard";
import { DayLoadBar, PastDaySummary, PlanEmpty } from "./PlanParts";
import { WeekColumns } from "./WeekColumns";

/** Days shown side by side in the wide Plan (7g). */
const WIDE_DAYS = 4;

type PlanViewProps = {
  /** "expanded" is 7a; "wide" is 7g: the day next to the coming days. */
  variant: "expanded" | "wide";
  work: Workday;
  todayKey: string;
  /** False until the shift is known (see useShift). */
  ready: boolean;
  calendar: CalendarState;
  /** Today's task details popover, shared with the Today tab. */
  todayDetails: TaskDetails;
  defaultReminderMinutes: number;
  onSaveError: () => void;
};

const noop = (): void => undefined;

/** "7 pm – 4 am": the working hours on the timeline. */
function workingHours(): string {
  const label = (minutes: number): string => {
    const hour = Math.floor(minutes / 60) % 24;
    return `${hour % 12 || 12} ${hour >= 12 ? "pm" : "am"}`;
  };
  return `${label(WORK_START_MIN)} – ${label(WORK_START_MIN + WORK_SPAN_MIN)}`;
}

/** The Plan tab (7a): a week strip, then the selected day's load, goals, note and tasks. */
export function PlanView({
  variant,
  work,
  todayKey,
  ready,
  calendar,
  todayDetails,
  defaultReminderMinutes,
  onSaveError,
}: PlanViewProps) {
  // Planning is mostly for the next day, so it opens on tomorrow (7a)
  const [day, setDay] = useState(() => addDays(todayKey, 1));
  const [monthOpen, setMonthOpen] = useState(false);
  // The wide Plan's first column (7g): today, until the arrows move it
  const [windowStart, setWindowStart] = useState(todayKey);
  const toast = useToast();
  const isToday = day === todayKey;
  const isPast = day < todayKey;

  // Today is the Today tab's own list, so the timer and both tabs stay in step
  const otherList = useTodayTasks(day, ready && !isToday && !isPast, onSaveError);
  const list = isToday ? work.list : otherList;
  const otherDetails = useTaskDetails({ ...otherList, remove: otherList.remove }, defaultReminderMinutes, todayKey);
  const details = isToday ? todayDetails : otherDetails;
  const plan = useDayPlan(isPast ? null : day, onSaveError);
  const past = useDaySummary(isPast ? day : null);

  const weekStart = weekStartKey(day);
  const listVersion = list.tasks.map((task) => `${task.id}:${task.estimateMinutes ?? 0}`).join(",");
  const week = useWeekSummary(weekStart, addDays(weekStart, 7), `${day}|${listVersion}`);
  const windowTasks = useDayRangeTasks(
    windowStart,
    addDays(windowStart, WIDE_DAYS),
    variant === "wide" ? `${day}|${listVersion}` : "",
  );
  const range = workDayRange(day);
  const events = useCalendarEvents(calendar, Date.parse(range.start), Date.parse(range.end)).events;

  const plannedMinutes = list.tasks
    .filter((task) => !task.completedAt)
    .reduce((sum, task) => sum + (task.estimateMinutes ?? 0), 0);
  const load = dayLoad(day, plannedMinutes, events);

  const pick = (key: string): void => {
    otherDetails.close();
    setDay(key);
    setMonthOpen(false);
  };

  const relative = isToday
    ? "Today"
    : day === addDays(todayKey, 1)
      ? "Tomorrow"
      : day === addDays(todayKey, -1)
        ? "Yesterday"
        : null;
  const title = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" }).format(
    fromLocalDayKey(day),
  );
  /** A task dropped on a day column (8b): moved, with Undo. */
  const moveTask = (id: string, to: string): void => {
    const moved = list.moveToDay(id, to);
    if (!moved) return;
    toast({
      message: `Moved to ${formatShortDate(fromLocalDayKey(to))}`,
      tone: "neutral",
      icon: "calendar_today",
      action: {
        label: "Undo",
        onClick: () => {
          list.undoMove(moved);
        },
      },
    });
  };

  const dayWork = isToday
    ? work
    : { list: otherList, timer: work.timer, startTask: noop, toggleDone: otherList.toggleDone };

  const header = (
    <div className={`relative z-1 flex shrink-0 flex-col gap-0.5 ${variant === "wide" ? "" : "mt-3 px-3.5"}`}>
      <h2 className="m-0 text-title tracking-title">{title}</h2>
      <span className="text-meta text-ink-muted">
        {relative ? `${relative} · ` : ""}
        {workingHours()}
      </span>
    </div>
  );

  if (variant === "wide") {
    const days = Array.from({ length: WIDE_DAYS }, (_, index) => addDays(windowStart, index));
    return (
      <div className="relative z-1 grid min-h-0 flex-1 grid-cols-[1fr_340px] gap-2.5 px-2.5 pb-2.5">
        <section
          aria-label={title}
          className="relative flex min-h-0 flex-col gap-2 overflow-hidden rounded-panel border border-white/80 bg-white/40 p-2.5 backdrop-blur-glass"
        >
          {header}
          {isPast ? (
            <PastDaySummary
              dayKey={day}
              planned={week.get(day)?.tasks ?? 0}
              doneCount={past.doneCount}
              trackedSeconds={past.trackedSeconds}
              className=""
            />
          ) : (
            <>
              <DayLoadBar load={load} />
              {plan.status === "ready" && <GoalsCard plan={plan} />}
              <TodayView
                work={dayWork}
                variant="wide"
                startable={isToday}
                showFilters={false}
                quickAddPlaceholder={`Add to ${formatShortDate(fromLocalDayKey(day))}, press Enter`}
                empty={<PlanEmpty dayKey={day} className="mt-1" />}
                details={details}
              />
            </>
          )}
        </section>
        <WeekColumns
          days={days}
          selectedKey={day}
          todayKey={todayKey}
          status={windowTasks.status}
          tasks={windowTasks.tasks}
          onSelect={pick}
          onShift={(direction) => {
            setWindowStart((start) => addDays(start, direction * WIDE_DAYS));
          }}
          onMoveTask={moveTask}
        />
        {!isToday && otherDetails.popover}
      </div>
    );
  }

  return (
    <div className="relative z-1 flex min-h-0 flex-1 flex-col">
      <div className="relative shrink-0">
        <WeekStrip
          selectedKey={day}
          todayKey={todayKey}
          eventDays={new Set()}
          monthOpen={monthOpen}
          onSelect={pick}
          onToggleMonth={() => {
            setMonthOpen((open) => !open);
          }}
          dayLine={(key, selected) => {
            const totals = week.get(key);
            const tasks = totals?.tasks ?? 0;
            const minutes = totals?.estimateMinutes ?? 0;
            let tone = "text-ink-muted";
            if (selected) tone = "text-white/85";
            else if (isOverPlanned(minutes)) tone = "text-status-error";
            return (
              <span aria-hidden="true" className={`font-mono text-[9px] leading-none font-medium ${tone}`}>
                {weekCellLabel(tasks, minutes)}
              </span>
            );
          }}
        />
        {monthOpen && (
          <MonthPicker
            selectedKey={day}
            todayKey={todayKey}
            position="top-12 left-3"
            onSelect={pick}
            onClose={() => {
              setMonthOpen(false);
            }}
          />
        )}
      </div>

      {header}

      {isPast ? (
        <div className="mt-2.5 flex flex-col">
          <PastDaySummary
            dayKey={day}
            planned={week.get(day)?.tasks ?? 0}
            doneCount={past.doneCount}
            trackedSeconds={past.trackedSeconds}
          />
        </div>
      ) : (
        <>
          <DayLoadBar load={load} className="mt-2.5 px-3.5" />
          {plan.status === "ready" && <GoalsCard plan={plan} className="mx-3 mt-2.5" />}
          <div className="mt-2.5 flex min-h-0 flex-1 flex-col">
            <TodayView
              work={dayWork}
              variant="expanded"
              startable={isToday}
              showFilters={false}
              quickAddPlaceholder={`Add to ${formatShortDate(fromLocalDayKey(day))}, press Enter`}
              empty={<PlanEmpty dayKey={day} />}
              details={details}
            />
          </div>
        </>
      )}
      {!isToday && otherDetails.popover}
    </div>
  );
}
