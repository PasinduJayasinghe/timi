import { useEffect, useRef } from "react";
import { Icon } from "../../components/Icon";
import { LiveDuration } from "../../components/LiveDuration";
import type { CalendarEvent } from "../../data/calendar";
import type { Session } from "../../data/types";
import { useNow } from "../../hooks/useNow";
import { formatSpan, hourLabel, nextMeeting, shortTime } from "../../lib/calendar";
import { formatDuration } from "../../lib/duration";
import { sessionSeconds } from "../../lib/sessionMath";
import { displayTitle, sessionDisplay } from "../../lib/taskDisplay";
import { styleOf } from "../../lib/taskTypes";
import { axisHours, timelineAxis } from "../../lib/timeline";
import { Avatars, eventTiming, JoinButton } from "./parts";

const HOUR_MS = 3_600_000;
/** 3a: one hour is 80px tall. */
const HOUR_PX = 80;

type DayViewProps = {
  dayKey: string;
  isToday: boolean;
  sessions: readonly Session[];
  events: readonly CalendarEvent[];
};

/** Day view (3a): tracked sessions next to Google Calendar events on the work-day hours. */
export function DayView({ dayKey, isToday, sessions, events }: DayViewProps) {
  const running = sessions.some((session) => session.endedAt === null);
  const now = useNow(isToday, running ? 1000 : 30_000);
  const scrollRef = useRef<HTMLDivElement>(null);

  const axis = timelineAxis(dayKey, sessions, now, events);
  const y = (ms: number): number => ((ms - axis.startMs) / HOUR_MS) * HOUR_PX;
  const height = y(axis.endMs);
  const next = isToday ? nextMeeting(events, now) : null;
  const showNow = isToday && now >= axis.startMs && now <= axis.endMs;

  // Open on the part of the day that matters: now, or else the first thing that happened
  const firstMs = Math.min(
    ...sessions.map((session) => Date.parse(session.startedAt)),
    ...events.map((event) => event.startMs),
    axis.endMs,
  );
  const focusY = y(showNow ? now : firstMs);
  useEffect(() => {
    const element = scrollRef.current;
    if (element) element.scrollTop = Math.max(0, focusY - HOUR_PX);
    // Only when the day changes, so the view doesn't jump while you scroll
  }, [dayKey]);

  return (
    <>
      <div
        aria-hidden="true"
        className="relative z-1 grid shrink-0 grid-cols-[36px_74px_1fr] px-3 text-micro tracking-[0.06em] text-ink-muted uppercase"
      >
        <span />
        <span>Tracked</span>
        <span className="pl-1.5">Google Calendar</span>
      </div>
      <div
        ref={scrollRef}
        className="relative z-1 mx-3 mt-1 min-h-0 flex-1 overflow-y-auto pb-3 [scrollbar-width:thin]"
      >
        <div className="relative" style={{ height }}>
          {axisHours(axis).map((hour) => (
            <div key={hour.ms} aria-hidden="true" style={{ top: y(hour.ms) }} className="absolute inset-x-0 flex">
              <span className="w-9 -translate-y-1.5 font-mono text-[10px] font-medium text-ink-muted">
                {hourLabel(hour.ms)}
              </span>
              <span className="flex-1 border-t border-ink-muted/14" />
            </div>
          ))}

          {/* Tracked lane */}
          <ul aria-label="Tracked" className="m-0 list-none p-0">
            {sessions.map((session) => {
              const isRunning = session.endedAt === null;
              const top = y(Date.parse(session.startedAt));
              const blockHeight = Math.max(22, y(isRunning ? now : Date.parse(session.endedAt ?? "")) - top - 2);
              const title = displayTitle(sessionDisplay(session));
              const tall = blockHeight >= 40;
              return (
                <li
                  key={session.id}
                  title={`${title} · ${formatDuration(sessionSeconds(session, now))}`}
                  style={{ top: top + 1, height: blockHeight }}
                  className={`absolute left-9.5 w-17 overflow-hidden border ${
                    tall ? "rounded-[9px] px-1.5 py-1.25 leading-[1.25]" : "rounded-[7px] px-1.5 leading-[20px]"
                  } ${
                    isRunning
                      ? "border-accent bg-running-block font-mono text-[10px] font-semibold text-accent-ink-hover shadow-running-block"
                      : `text-[10.5px] font-semibold ${styleOf({ type: session.taskType, calendarEventId: session.calendarEventId }).bar}`
                  }`}
                >
                  {isRunning ? (
                    <>
                      ● <LiveDuration baseSeconds={0} runningSince={session.startedAt} format="clock" />
                    </>
                  ) : (
                    <>
                      <span className="block truncate">{title}</span>
                      {tall && (
                        <span className="block font-mono text-[10px] font-medium">
                          {formatDuration(sessionSeconds(session, now))}
                        </span>
                      )}
                    </>
                  )}
                </li>
              );
            })}
          </ul>

          {/* Google Calendar lane */}
          <ul aria-label="Google Calendar" className="m-0 list-none p-0">
            {events.map((event) => {
              const past = event.endMs <= now;
              if (event.id === next?.id) {
                return (
                  <li
                    key={event.id}
                    style={{ top: y(event.startMs) }}
                    className="absolute right-0 left-29 z-2 flex min-h-15 flex-col gap-1.75 rounded-md border border-type-calendar/55 bg-white/75 px-2.5 py-2 shadow-meeting"
                  >
                    <div className="flex items-center gap-1.5">
                      <span aria-hidden="true" className="w-1 self-stretch rounded-[2px] bg-type-calendar" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-ui-sm font-semibold">{event.title}</div>
                        <div className="font-mono text-duration font-medium text-ink-muted">
                          {eventTiming(event, now)}
                        </div>
                      </div>
                    </div>
                    {(event.meetUrl || event.attendees.length > 0) && (
                      <div className="flex items-center gap-1.5">
                        <Avatars attendees={event.attendees} />
                        <span className="flex-1" />
                        <JoinButton event={event} variant="primary" />
                      </div>
                    )}
                  </li>
                );
              }
              const meet = event.meetUrl !== null;
              return (
                <li
                  key={event.id}
                  style={{ top: y(event.startMs) }}
                  className={`absolute right-0 left-29 flex h-10 items-center gap-1.5 rounded-control border pr-1.5 pl-2.5 ${
                    meet ? "border-type-calendar/50 bg-type-calendar/16" : "border-type-calendar/40 bg-type-calendar/10"
                  } ${past ? "opacity-60" : ""}`}
                >
                  <Icon name={meet ? "videocam" : "event"} size={15} className="text-type-calendar-ink" />
                  <div className="min-w-0 flex-1 leading-[1.15]">
                    <div className="truncate text-caption font-semibold">{event.title}</div>
                    <div className="truncate font-mono text-[10px] font-medium text-ink-muted">
                      {formatSpan(event.startMs, event.endMs, false)}
                      {!meet && ` · ${event.location ? `${event.location}, no Meet link` : "no Meet link"}`}
                    </div>
                  </div>
                  {!past && <JoinButton event={event} variant="compact" />}
                </li>
              );
            })}
          </ul>

          {showNow && (
            <div
              aria-hidden="true"
              style={{ top: y(now) }}
              className="pointer-events-none absolute right-0 left-8 z-3 h-0.5 bg-accent-ink"
            >
              <span className="absolute -top-0.75 -left-1 size-2 rounded-full bg-accent-ink" />
              <span className="absolute -top-2.25 right-0 rounded-xs bg-accent-ink px-1.5 py-px font-mono text-[10px] font-semibold text-white">
                {shortTime(now)}
              </span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
