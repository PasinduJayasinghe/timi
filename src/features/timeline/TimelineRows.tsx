import { useState } from "react";
import { Icon } from "../../components/Icon";
import { openMeet, type CalendarEvent } from "../../data/calendar";
import type { Session } from "../../data/types";
import { useNow } from "../../hooks/useNow";
import { formatDuration, formatTimeOfDay } from "../../lib/duration";
import { sessionSeconds, totalsBySummary } from "../../lib/sessionMath";
import { SUMMARY_STYLES } from "../../lib/summaryStyles";
import { displayTitle, sessionDisplay, whoLabel } from "../../lib/taskDisplay";
import { styleOf } from "../../lib/taskTypes";
import {
  axisHours,
  axisLabels,
  axisPercent,
  barPosition,
  rangePosition,
  rowOf,
  TIMELINE_ROWS,
  timelineAxis,
} from "../../lib/timeline";
import { TimelineTooltip, type TooltipContent } from "./TimelineTooltip";

export type TimelineRowsProps = {
  /** "expanded" is the 1a panel; "wide" is the 1d strip. */
  variant: "expanded" | "wide";
  dayKey: string;
  sessions: readonly Session[];
  isToday: boolean;
  /** Whether a bar's task can be opened, i.e. it is on today's list. */
  canOpen: (taskId: string) => boolean;
  onOpen: (taskId: string, bar: HTMLElement) => void;
  /** Calendar meetings still to come, shown dashed in the Meetings row (1f). Not counted in totals. */
  meetings?: readonly CalendarEvent[];
};

function sessionTooltip(session: Session, now: number, openable: boolean): TooltipContent {
  const task = sessionDisplay(session);
  const style = styleOf(task);
  const who = whoLabel(task);
  return {
    icon: style.icon,
    ink: style.ink,
    heading: who ? `${style.label} · ${who}` : style.label,
    title: displayTitle(task),
    range: `${formatTimeOfDay(session.startedAt)} → ${session.endedAt ? formatTimeOfDay(session.endedAt) : "now"}`,
    duration: formatDuration(sessionSeconds(session, now)),
    footer: openable ? "Click to open task" : null,
  };
}

/** Upcoming calendar meeting (1a script: "Calendar meeting", "(upcoming)"). */
function eventTooltip(event: CalendarEvent): TooltipContent {
  const iso = (ms: number): string => new Date(ms).toISOString();
  return {
    icon: "videocam",
    ink: "text-type-calendar-ink",
    heading: "Calendar meeting · upcoming",
    title: event.title,
    range: `${formatTimeOfDay(iso(event.startMs))} → ${formatTimeOfDay(iso(event.endMs))}`,
    duration: formatDuration((event.endMs - event.startMs) / 1000),
    footer: event.meetUrl ? "Click to join Google Meet" : null,
  };
}

/** Expanded bars show their duration from 40 minutes (1a script); wide bars show a label from 5% of the axis (1d). */
const EXPANDED_LABEL_SECONDS = 40 * 60;
const WIDE_LABEL_PERCENT = 5;

/** Row labels, hour axis, one track per row with its session bars, the now line and row totals. */
export function TimelineRows({
  variant,
  dayKey,
  sessions,
  isToday,
  canOpen,
  onOpen,
  meetings = [],
}: TimelineRowsProps) {
  const wide = variant === "wide";
  const running = sessions.some((session) => session.endedAt === null);
  // Once a second while a bar grows; otherwise often enough to move the now line
  const now = useNow(isToday, running ? 1000 : 30_000);
  const [hover, setHover] = useState<{ content: TooltipContent; bar: HTMLElement } | null>(null);

  const axis = timelineAxis(dayKey, sessions, now, meetings);
  const totals = totalsBySummary(sessions, now);
  const nowPercent = isToday ? axisPercent(now, axis) : null;
  const labels = axisLabels(axis, variant);

  const rowHeight = wide ? "h-5" : "h-6";
  const rowRadius = wide ? "rounded-[6px]" : "rounded-[7px]";
  const rowGap = wide ? "gap-0.75" : "gap-1";

  return (
    <div className={`flex min-h-0 flex-1 ${wide ? "gap-2" : "gap-1.5"}`}>
      {/* Row labels: icon tiles (1a) or icon and name (1d) */}
      <div className={`flex shrink-0 flex-col ${rowGap} ${wide ? "w-21 pt-4" : "w-6 pt-4.5"}`}>
        {TIMELINE_ROWS.map((key) => {
          const row = SUMMARY_STYLES[key];
          return wide ? (
            <span key={key} className={`flex h-5 items-center gap-1.25 text-duration font-semibold ${row.ink}`}>
              <Icon name={row.icon} size={14} />
              {row.label}
            </span>
          ) : (
            <span
              key={key}
              title={row.title}
              className={`grid h-6 place-items-center rounded-[7px] ${row.tint} ${row.ink}`}
            >
              <Icon name={row.icon} size={15} />
            </span>
          );
        })}
      </div>

      <div className="relative min-w-0 flex-1">
        <div aria-hidden="true" className="relative h-3.5 font-mono text-[9.5px] font-medium text-ink-muted">
          {labels.map((label) => (
            <span
              key={`${label.text}-${label.percent}`}
              style={label.align === "end" ? { right: 0 } : { left: `${label.percent}%` }}
              className={`absolute whitespace-nowrap ${label.align === "center" ? "-translate-x-1/2" : ""}`}
            >
              {label.text}
            </span>
          ))}
        </div>

        {/* Hour lines: solid every 2 hours, dashed between (1a) */}
        {!wide && (
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-4 bottom-0">
            {axisHours(axis).map((hour, index) => (
              <span
                key={hour.ms}
                style={{ left: `${hour.percent}%` }}
                className={`absolute inset-y-0 border-l ${
                  index % 2 === 0 ? "border-solid border-ink-muted/14" : "border-dashed border-ink-muted/10"
                }`}
              />
            ))}
            <span className="absolute inset-y-0 right-0 border-r border-ink-muted/14" />
          </div>
        )}

        <div className={`flex flex-col ${rowGap} ${wide ? "mt-0.5" : "mt-1"}`}>
          {TIMELINE_ROWS.map((key) => (
            <div
              key={key}
              role="group"
              aria-label={SUMMARY_STYLES[key].title}
              className={`relative ${rowHeight} ${rowRadius} bg-white/30`}
            >
              {sessions
                .filter((session) => rowOf(session) === key)
                .map((session) => {
                  const { left, width } = barPosition(session, axis, now);
                  const isRunning = session.endedAt === null;
                  const seconds = sessionSeconds(session, now);
                  const title = displayTitle(sessionDisplay(session));
                  const openable = canOpen(session.taskId);
                  let label = "";
                  if (!isRunning) {
                    if (wide && width >= WIDE_LABEL_PERCENT) label = `${title} · ${formatDuration(seconds)}`;
                    else if (!wide && seconds >= EXPANDED_LABEL_SECONDS) label = formatDuration(seconds);
                  }
                  const surface = isRunning
                    ? `border-accent bg-running-bar text-accent-ink-hover ${wide ? "shadow-running-bar" : ""}`
                    : styleOf(sessionDisplay(session)).bar;
                  return (
                    <button
                      key={session.id}
                      type="button"
                      aria-label={`${title}, ${formatTimeOfDay(session.startedAt)} to ${
                        session.endedAt ? formatTimeOfDay(session.endedAt) : "now"
                      }, ${formatDuration(seconds)}`}
                      onMouseEnter={(event) => {
                        setHover({ content: sessionTooltip(session, now, openable), bar: event.currentTarget });
                      }}
                      onMouseLeave={() => {
                        setHover(null);
                      }}
                      onFocus={(event) => {
                        setHover({ content: sessionTooltip(session, now, openable), bar: event.currentTarget });
                      }}
                      onBlur={() => {
                        setHover(null);
                      }}
                      onClick={(event) => {
                        if (!openable) return;
                        setHover(null);
                        onOpen(session.taskId, event.currentTarget);
                      }}
                      style={{ left: `${left}%`, width: `${width}%` }}
                      className={`absolute inset-y-0 flex min-w-1 items-center border whitespace-nowrap transition-[transform,box-shadow] duration-200 hover:z-2 hover:-translate-y-px hover:shadow-bar-hover focus-visible:z-2 ${rowRadius} ${surface} ${
                        wide
                          ? "justify-start overflow-hidden px-1.5 text-micro"
                          : "justify-center font-mono text-[9.5px] font-semibold"
                      } ${openable ? "cursor-pointer" : "cursor-default"}`}
                    >
                      {wide ? <span className="truncate">{label}</span> : label}
                      {isRunning && !wide && (
                        <span
                          aria-hidden="true"
                          className="absolute -right-0.75 inset-y-0.5 w-[5px] animate-pulse-edge rounded-[3px] bg-accent-gradient shadow-pulse"
                        />
                      )}
                    </button>
                  );
                })}
              {key === "meetings" &&
                meetings.map((meeting) => {
                  const { left, width } = rangePosition(meeting.startMs, meeting.endMs, axis);
                  const content = eventTooltip(meeting);
                  const label = wide && width >= WIDE_LABEL_PERCENT ? meeting.title : "";
                  const { meetUrl } = meeting;
                  return (
                    <button
                      key={meeting.id}
                      type="button"
                      aria-label={`${meeting.title}, upcoming meeting, ${content.range}${meetUrl ? ", join Google Meet" : ""}`}
                      onMouseEnter={(event) => {
                        setHover({ content, bar: event.currentTarget });
                      }}
                      onMouseLeave={() => {
                        setHover(null);
                      }}
                      onFocus={(event) => {
                        setHover({ content, bar: event.currentTarget });
                      }}
                      onBlur={() => {
                        setHover(null);
                      }}
                      onClick={() => {
                        if (!meetUrl) return;
                        openMeet(meetUrl).catch((error: unknown) => {
                          console.error("[timeline] join failed", error);
                        });
                      }}
                      style={{ left: `${left}%`, width: `${width}%` }}
                      className={`absolute inset-y-0 flex min-w-1 items-center overflow-hidden border border-dashed border-type-calendar/80 bg-type-calendar/10 whitespace-nowrap text-type-calendar-ink-strong transition-[transform,box-shadow] duration-200 hover:z-2 hover:-translate-y-px hover:shadow-bar-hover focus-visible:z-2 ${rowRadius} ${
                        wide ? "justify-start px-1.5 text-micro" : ""
                      } ${meetUrl ? "cursor-pointer" : "cursor-default"}`}
                    >
                      {label && <span className="truncate">{label}</span>}
                    </button>
                  );
                })}
            </div>
          ))}
        </div>

        {nowPercent !== null && (
          <div
            aria-hidden="true"
            style={{ left: `${nowPercent}%` }}
            className={`pointer-events-none absolute top-2.5 -ml-px w-0.5 rounded-[1px] bg-accent-ink shadow-now ${
              wide ? "bottom-0" : "-bottom-0.5"
            }`}
          >
            <div className="absolute -top-0.75 -left-0.75 size-2 rounded-full bg-accent-ink" />
          </div>
        )}
      </div>

      {/* Row totals: the same numbers as the Log (3f) */}
      <div
        className={`flex shrink-0 flex-col text-right font-mono text-[10.5px] font-medium text-ink ${rowGap} ${
          wide ? "w-13 pt-4" : "w-10.5 pt-4.5"
        }`}
      >
        {TIMELINE_ROWS.map((key) => (
          <span key={key} className={wide ? "h-5 leading-5" : "h-6 leading-6"}>
            <span className="sr-only">{SUMMARY_STYLES[key].title}: </span>
            {totals[key] > 0 ? formatDuration(totals[key]) : "—"}
          </span>
        ))}
      </div>

      {hover && <TimelineTooltip content={hover.content} anchor={hover.bar} />}
    </div>
  );
}
