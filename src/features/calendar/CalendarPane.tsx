import { Icon } from "../../components/Icon";
import type { CalendarEvent } from "../../data/calendar";
import type { Session } from "../../data/types";
import type { CalendarState } from "../../hooks/useCalendar";
import { useNow } from "../../hooks/useNow";
import { formatSpan, hourLabel, nextMeeting, shortTime, startsIn } from "../../lib/calendar";
import { CalendarEmpty } from "./CalendarEmpty";
import { JoinButton } from "./parts";

const HOUR_MS = 3_600_000;
/** 1d shows five hours, starting with the current one. */
const HOURS = 5;

type CalendarPaneProps = {
  calendar: CalendarState;
  /** Today's events and sessions. */
  events: readonly CalendarEvent[];
  sessions: readonly Session[];
};

/** Calendar pane in wide mode (1d): the next few hours, with the next meeting and Join Meet. */
export function CalendarPane({ calendar, events, sessions }: CalendarPaneProps) {
  const { status } = calendar;
  const running = sessions.some((session) => session.endedAt === null);
  const now = useNow(true, running ? 1000 : 30_000);

  const header = (
    <div className="relative flex items-center gap-1.5">
      <span className="flex-1 text-ui-sm font-semibold">Calendar</span>
      {status?.connected &&
        (status.problem ? (
          <button
            type="button"
            onClick={status.problem === "auth" ? calendar.connect : calendar.retry}
            className="flex h-8 items-center gap-1 rounded-sm px-1.5 text-duration font-semibold text-status-error hover:bg-white/60"
          >
            <span aria-hidden="true" className="size-1.5 rounded-full bg-status-error-edge" />
            {status.problem === "auth" ? "Reconnect" : "Couldn’t sync · Retry"}
          </button>
        ) : (
          <span className="flex items-center gap-1 text-duration font-semibold text-status-success">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-type-support" />
            Connected
          </span>
        ))}
    </div>
  );

  if (!status?.connected) {
    return (
      <>
        {header}
        {status && <CalendarEmpty calendar={calendar} className="flex-1 px-1" />}
      </>
    );
  }

  const start = new Date(now);
  start.setMinutes(0, 0, 0);
  const windowStart = start.getTime();
  const windowEnd = windowStart + HOURS * HOUR_MS;
  const percent = (ms: number): number => ((ms - windowStart) / (windowEnd - windowStart)) * 100;
  const inWindow = events.filter(
    (event) => event.endMs > windowStart && event.startMs < windowEnd && event.endMs > now,
  );
  const next = nextMeeting(inWindow, now);

  return (
    <>
      {header}
      <div className="relative grid flex-1 grid-cols-[34px_1fr] grid-rows-5 font-mono text-[10px] font-medium text-ink-muted">
        {Array.from({ length: HOURS }, (_, index) => (
          <div key={index} aria-hidden="true" className="contents">
            <span>{hourLabel(windowStart + index * HOUR_MS)}</span>
            <span className="border-t border-ink-muted/14" />
          </div>
        ))}

        {/* Tracked strip */}
        {sessions.map((session) => {
          const from = Math.max(Date.parse(session.startedAt), windowStart);
          const to = Math.min(session.endedAt ? Date.parse(session.endedAt) : now, windowEnd);
          if (to <= from) return null;
          return (
            <span
              key={session.id}
              title={`Tracked: ${session.taskTitle}`}
              style={{ top: `${percent(from)}%`, height: `${Math.max(1, percent(to) - percent(from))}%` }}
              className="absolute left-8.5 w-1 rounded-[2px] bg-accent-gradient"
            />
          );
        })}

        <ul aria-label="Meetings" className="m-0 contents list-none p-0">
          {inWindow.map((event) => {
            const top = `${Math.max(0, percent(event.startMs))}%`;
            if (event.id === next?.id) {
              return (
                <li
                  key={event.id}
                  style={{ top }}
                  className="absolute right-0 left-10.5 flex flex-col gap-1.5 rounded-control border border-type-calendar/60 bg-type-calendar/22 px-2.25 py-1.75 font-sans"
                >
                  <div className="flex items-center gap-1.25 text-caption font-semibold text-ink">
                    <Icon name="videocam" size={15} className="text-type-calendar-ink" />
                    <span className="truncate">{event.title}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="flex-1 font-mono text-duration font-medium text-ink-muted">
                      {formatSpan(event.startMs, event.endMs, false)} · {startsIn(event, now)}
                    </span>
                    <JoinButton event={event} variant="pane" />
                  </div>
                </li>
              );
            }
            return (
              <li
                key={event.id}
                style={{ top }}
                className="absolute right-0 left-10.5 flex items-center gap-1.25 rounded-sm border border-type-calendar/45 bg-type-calendar/16 px-2.25 py-1.25 font-sans text-caption font-semibold text-ink"
              >
                <Icon name={event.meetUrl ? "videocam" : "event"} size={15} className="text-type-calendar-ink" />
                <span className="flex-1 truncate">{event.title}</span>
                <span className="font-mono text-duration font-medium text-ink-muted">{shortTime(event.startMs)}</span>
              </li>
            );
          })}
        </ul>

        <div
          aria-hidden="true"
          style={{ top: `${percent(now)}%` }}
          className="pointer-events-none absolute right-0 left-8.5 h-0.5 bg-accent-ink"
        >
          <span className="absolute -top-0.75 -left-1 size-2 rounded-full bg-accent-ink" />
        </div>
      </div>
    </>
  );
}
