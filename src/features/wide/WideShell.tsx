import { FooterBar } from "../../components/FooterBar";
import { ROSE_BLOB } from "../../components/WindowFrame";
import type { TodayTasks } from "../../hooks/useTodayTasks";
import { CalendarEmpty } from "../calendar/CalendarEmpty";
import { LogEmpty } from "../log/LogEmpty";
import { TodayView } from "../today/TodayView";

export type WideView = "today-calendar" | "log";

type WideShellProps = {
  view: WideView;
  date: Date;
  total: string;
  list: TodayTasks;
};

/** Wide mode body (1d frame; 3g for Log). The timeline strip arrives with Phase 3. */
export function WideShell({ view, date, total, list }: WideShellProps) {
  if (view === "log") {
    return (
      <div role="tabpanel" id="panel-log" aria-labelledby="tab-log" className="relative z-1 flex min-h-0 flex-1 flex-col px-3 pb-3">
        <LogEmpty date={date} variant="wide" />
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
          className="flex min-h-0 flex-col gap-2 overflow-hidden rounded-panel border border-white/80 bg-white/40 p-2.5 backdrop-blur-glass"
        >
          <TodayView list={list} variant="wide" />
        </section>
        <section
          aria-label="Calendar"
          className="relative flex min-h-0 flex-col gap-2 overflow-hidden rounded-panel border border-white/80 bg-white/40 px-3 py-2.5 backdrop-blur-glass"
        >
          <div aria-hidden="true" className={`${ROSE_BLOB} -top-15 -right-15`} />
          <div className="relative flex items-center gap-1.5">
            <span className="flex-1 text-ui-sm font-semibold">Calendar</span>
          </div>
          <CalendarEmpty className="flex-1 px-1" />
        </section>
      </div>
      <FooterBar total={total} variant="wide" />
    </>
  );
}
