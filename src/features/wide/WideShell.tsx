import type { ReactNode } from "react";
import { FooterBar } from "../../components/FooterBar";
import type { LiveTotal } from "../../components/LiveDuration";
import { ROSE_BLOB } from "../../components/WindowFrame";
import type { CalendarEvent } from "../../data/calendar";
import type { CalendarState } from "../../hooks/useCalendar";
import type { Workday } from "../../hooks/useWorkday";
import { CalendarPane } from "../calendar/CalendarPane";
import { LogView } from "../log/LogView";
import { TimelineStrip } from "../timeline/TimelinePanel";
import type { TimelineRowsProps } from "../timeline/TimelineRows";
import { TodayView } from "../today/TodayView";
import type { TaskDetails } from "../today/useTaskDetails";

export type WideView = "today-calendar" | "log";

type WideShellProps = {
  view: WideView;
  todayKey: string;
  total: LiveTotal;
  work: Workday;
  details: TaskDetails;
  calendar: CalendarState;
  /** Today's calendar events (the pane), and the ones still to come (the timeline strip). */
  todayEvents: readonly CalendarEvent[];
  /** What timeline bars do when clicked, and upcoming meetings on the strip. */
  barActions: Pick<TimelineRowsProps, "canOpen" | "onOpen" | "meetings">;
  onStartTask: () => void;
  /** The Start task sheet, shown inside the Today pane. */
  sheet: ReactNode;
  focusQuickAdd: number;
  nextMeeting: { title: string; startMs: number } | null;
};

/** Wide mode body (1d frame, with the timeline strip; 3g for Log). */
export function WideShell({
  view,
  todayKey,
  total,
  work,
  details,
  calendar,
  todayEvents,
  barActions,
  onStartTask,
  sheet,
  focusQuickAdd,
  nextMeeting,
}: WideShellProps) {
  if (view === "log") {
    return (
      <div
        role="tabpanel"
        id="panel-log"
        aria-labelledby="tab-log"
        className="relative z-1 flex min-h-0 flex-1 flex-col px-3 pb-3"
      >
        <LogView variant="wide" todayKey={todayKey} timer={work.timer} />
      </div>
    );
  }

  return (
    <>
      <div
        role="tabpanel"
        id="panel-today-calendar"
        aria-labelledby="tab-today-calendar"
        className="relative z-1 grid min-h-0 flex-1 grid-cols-[1fr_300px] gap-2.5 px-2.5"
      >
        <section
          aria-label="Today"
          className="relative flex min-h-0 flex-col gap-2 overflow-hidden rounded-panel border border-white/80 bg-white/40 p-2.5 backdrop-blur-glass"
        >
          <TodayView
            work={work}
            variant="wide"
            onStartTask={onStartTask}
            details={details}
            focusQuickAdd={focusQuickAdd}
            nextMeeting={nextMeeting}
          />
          {sheet}
        </section>
        <section
          aria-label="Calendar"
          className="relative flex min-h-0 flex-col gap-2 overflow-hidden rounded-panel border border-white/80 bg-white/40 px-3 py-2.5 backdrop-blur-glass"
        >
          {/* 3c rose blob, while not connected */}
          {calendar.status?.connected === false && (
            <div aria-hidden="true" className={`${ROSE_BLOB} -top-15 -right-15`} />
          )}
          <CalendarPane calendar={calendar} events={todayEvents} sessions={work.timer.todaySessions} />
        </section>
      </div>
      <TimelineStrip todayKey={todayKey} timer={work.timer} {...barActions} />
      <FooterBar total={total} variant="wide" />
    </>
  );
}
