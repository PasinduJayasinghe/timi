import type { CalendarEvent } from "../../data/calendar";
import type { Session } from "../../data/types";
import { useNow } from "../../hooks/useNow";
import { formatWeekTotal, hourLabel } from "../../lib/calendar";
import { formatDuration } from "../../lib/duration";
import { fromLocalDayKey, workDayKey } from "../../lib/date";
import { totalSeconds } from "../../lib/sessionMath";
import { axisHours, axisPercent, barPosition, rangePosition, timelineAxis } from "../../lib/timeline";
import { weekDays } from "./DatePickers";

/** Block colours in the week columns (3b): type colour at about 30%, calendar rose at 50%. */
const BLOCK: Record<Session["taskType"], string> = {
  client: "bg-type-client/30",
  internal: "bg-type-internal/30",
  support: "bg-type-support/28",
  meeting: "bg-type-meeting/30",
  other: "bg-type-other/35",
};

type WeekViewProps = {
  /** Any day in the week. */
  dayKey: string;
  todayKey: string;
  sessions: readonly Session[];
  events: readonly CalendarEvent[];
  onOpenDay: (key: string) => void;
};

/** Week view (3b): a mini timeline and total per day on the working hours. Tap a day to open it. */
export function WeekView({ dayKey, todayKey, sessions, events, onOpenDay }: WeekViewProps) {
  const days = weekDays(dayKey);
  const showsToday = days.includes(todayKey);
  const running = sessions.some((session) => session.endedAt === null);
  const now = useNow(showsToday, running ? 1000 : 30_000);
  // The same working hours for every day, so the columns line up (7p 10p 1a 4a)
  const labelAxis = timelineAxis(days[0], [], now);
  const labels = [...axisHours(labelAxis).filter((_, index) => index % 3 === 0), { ms: labelAxis.endMs }];

  const perDay = days.map((key) => {
    const daySessions = sessions.filter((session) => workDayKey(new Date(session.startedAt)) === key);
    const dayEvents = events.filter((event) => workDayKey(new Date(event.startMs)) === key);
    return { key, sessions: daySessions, events: dayEvents, total: totalSeconds(daySessions, now) };
  });

  return (
    <div className="relative z-1 mx-3 flex min-h-0 flex-col gap-2.5 overflow-y-auto pb-3 [scrollbar-width:thin]">
      <div className="grid shrink-0 grid-cols-[28px_repeat(7,1fr)] gap-0.75 rounded-lg border border-white/85 bg-white/55 px-1.5 py-2">
        <span />
        {perDay.map(({ key }) => {
          const date = fromLocalDayKey(key);
          const letter = new Intl.DateTimeFormat("en-GB", { weekday: "narrow" }).format(date);
          return (
            <span
              key={key}
              className={`text-center text-[10.5px] ${
                key === todayKey ? "rounded-xs bg-accent-ink font-bold text-white" : "font-semibold text-ink-muted"
              }`}
            >
              {letter} {date.getDate()}
            </span>
          );
        })}

        <span className="font-mono text-[9.5px] font-medium text-ink-muted">total</span>
        {perDay.map(({ key, total }) => (
          <span
            key={key}
            className={`text-center font-mono text-[10px] ${
              key === todayKey
                ? "font-semibold text-accent-ink"
                : key > todayKey
                  ? "font-medium text-ink-muted"
                  : "font-medium"
            }`}
          >
            {key > todayKey ? "—" : formatWeekTotal(total)}
          </span>
        ))}

        <div
          aria-hidden="true"
          className="flex h-75 flex-col justify-between font-mono text-[9.5px] font-medium text-ink-muted"
        >
          {labels.map((label) => (
            <span key={label.ms}>{hourLabel(label.ms)}</span>
          ))}
        </div>
        {perDay.map((day) => {
          const axis = timelineAxis(day.key, [], now);
          const isToday = day.key === todayKey;
          const nowPercent = isToday ? axisPercent(now, axis) : null;
          const date = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" }).format(
            fromLocalDayKey(day.key),
          );
          return (
            <button
              key={day.key}
              type="button"
              aria-label={`${date}: ${formatDuration(day.total)} tracked. Open the day`}
              onClick={() => {
                onOpenDay(day.key);
              }}
              className={`relative h-75 overflow-hidden rounded-xs hover:bg-white/70 ${
                isToday
                  ? "bg-white/60 ring-[1.5px] ring-accent-ink/35 ring-inset"
                  : day.key > todayKey
                    ? "bg-white/20"
                    : "bg-white/35"
              }`}
            >
              {day.sessions.map((session) => {
                const { left, width } = barPosition(session, axis, now);
                if (width <= 0) return null;
                return (
                  <span
                    key={session.id}
                    style={{ top: `${left}%`, height: `${width}%` }}
                    className={`absolute inset-x-1 rounded-[4px] ${
                      session.endedAt === null ? "bg-accent-gradient" : BLOCK[session.taskType]
                    }`}
                  />
                );
              })}
              {day.events.map((event) => {
                const { left, width } = rangePosition(event.startMs, event.endMs, axis);
                if (width <= 0) return null;
                return (
                  <span
                    key={event.id}
                    style={{ top: `${left}%`, height: `${width}%` }}
                    className={`absolute inset-x-1 rounded-[4px] ${
                      event.startMs > now ? "border border-dashed border-type-calendar" : "bg-type-calendar/50"
                    }`}
                  />
                );
              })}
              {nowPercent !== null && (
                <span style={{ top: `${nowPercent}%` }} className="absolute inset-x-0.5 h-0.5 bg-accent-ink" />
              )}
            </button>
          );
        })}
      </div>

      <div aria-hidden="true" className="flex shrink-0 flex-wrap gap-2.5 px-1 text-duration text-ink-muted">
        {[
          ["Client", "bg-type-client/50"],
          ["Internal", "bg-type-internal/50"],
          ["Support", "bg-type-support/50"],
          ["Calendar", "bg-type-calendar/70"],
        ].map(([label, swatch]) => (
          <span key={label} className="flex items-center gap-1">
            <span className={`size-2.5 rounded-[3px] ${swatch}`} />
            {label}
          </span>
        ))}
        <span>Tap a day to open it</span>
      </div>
    </div>
  );
}
