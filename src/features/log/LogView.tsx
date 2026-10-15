import { useEffect, useState } from "react";
import { Icon } from "../../components/Icon";
import { IconButton } from "../../components/IconButton";
import { LoadError } from "../../components/LoadError";
import type { Session } from "../../data/types";
import { useDaySessions } from "../../hooks/useDaySessions";
import { useNow } from "../../hooks/useNow";
import type { Timer } from "../../hooks/useTimer";
import { addDays, formatShortDate, fromLocalDayKey } from "../../lib/date";
import { formatDuration, formatTimeOfDay, formatTimeRange } from "../../lib/duration";
import { sessionSeconds, SUMMARY_KEYS, totalSeconds, totalsBySummary, type SummaryKey } from "../../lib/sessionMath";
import { displayTitle, sessionDisplay, whereLabel } from "../../lib/taskDisplay";
import { TYPE_STYLES } from "../../lib/taskTypes";
import { buildTimesheet } from "../../lib/timesheet";
import { LogEmpty } from "./LogEmpty";

type LogViewProps = {
  /** "expanded" is 3f; "wide" is 3g. */
  variant: "expanded" | "wide";
  todayKey: string;
  /** Today's sessions come from the timer, so the running one stays live. */
  timer: Timer;
};

/** Summary groups (3f): meetings use the calendar colour and icon, as in the design. */
const SUMMARY: Record<SummaryKey, { label: string; icon: string; ink: string; bar: string }> = {
  client: { label: "Client", icon: "work", ink: "text-type-client-ink", bar: "bg-type-client" },
  internal: { label: "Internal", icon: "folder", ink: "text-type-internal-ink", bar: "bg-type-internal" },
  support: { label: "Support", icon: "confirmation_number", ink: "text-type-support-ink", bar: "bg-type-support" },
  meetings: { label: "Meetings", icon: "videocam", ink: "text-type-calendar-ink", bar: "bg-type-calendar" },
  other: { label: "Other", icon: "category", ink: "text-type-other-ink", bar: "bg-type-other" },
};

type CopyState = { kind: "idle" } | { kind: "copied"; rows: number } | { kind: "failed" };

const COPIED_MS = 2200;

/** Log tab (3f; 3g in wide mode): one day's sessions, totals per type and "Copy for timesheet". */
export function LogView({ variant, todayKey, timer }: LogViewProps) {
  const wide = variant === "wide";
  // Days back from today, so the Log follows the date over midnight
  const [offset, setOffset] = useState(0);
  const day = addDays(todayKey, offset);
  const isToday = offset === 0;

  const past = useDaySessions(isToday ? null : day);
  const status = isToday ? timer.status : past.status;
  const sessions = isToday ? timer.todaySessions : past.sessions;
  const reload = isToday ? timer.reload : past.reload;
  const live = sessions.some((session) => session.endedAt === null);
  const now = useNow(live);

  const [copy, setCopy] = useState<CopyState>({ kind: "idle" });
  useEffect(() => {
    if (copy.kind === "idle") return;
    const timeoutId = window.setTimeout(() => {
      setCopy({ kind: "idle" });
    }, COPIED_MS);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [copy]);

  const copyTimesheet = (): void => {
    navigator.clipboard
      .writeText(buildTimesheet(sessions, Date.now()))
      .then(() => {
        setCopy({ kind: "copied", rows: sessions.length });
      })
      .catch((error: unknown) => {
        console.error("[log] copy failed", error);
        setCopy({ kind: "failed" });
      });
  };

  const goTo = (next: number): void => {
    setOffset(Math.min(0, next));
    setCopy({ kind: "idle" });
  };

  const total = totalSeconds(sessions, now);
  const dateLabel = formatShortDate(fromLocalDayKey(day));
  const hasRows = status === "ready" && sessions.length > 0;
  const copied = copy.kind === "copied";

  const copyButton = (
    <button
      type="button"
      onClick={copyTimesheet}
      className={`flex items-center justify-center gap-2 font-semibold text-white transition-[background-color] duration-250 focus-visible:outline-offset-3 ${
        copied ? "bg-status-success" : "bg-accent-gradient-strong"
      } ${wide ? "h-9.5 gap-1.5 rounded-control px-3.5 text-ui" : "h-11 rounded-md text-body shadow-copy"}`}
    >
      <Icon name={copied ? "check" : "content_copy"} size={18} />
      {copied ? (wide ? `Copied · ${copy.rows} rows` : "Copied to clipboard") : "Copy for timesheet"}
    </button>
  );

  let copyHint = "";
  if (copy.kind === "copied") copyHint = `${copy.rows} rows as tab-separated text · paste into your timesheet`;
  else if (copy.kind === "failed") copyHint = "Couldn’t copy to the clipboard. Try again.";
  else if (live) copyHint = "Running session is included up to now";

  const picker = (
    <div className={`flex shrink-0 items-center ${wide ? "gap-1.5 pb-2.5" : "gap-0.5 pb-2"}`}>
      <IconButton
        icon="chevron_left"
        label="Previous day"
        onClick={() => {
          goTo(offset - 1);
        }}
        className="hover:bg-white/80"
      />
      <button
        type="button"
        title={isToday ? undefined : "Back to today"}
        onClick={() => {
          goTo(0);
        }}
        className={`flex h-8 items-center gap-1.5 rounded-sm px-2.5 text-ui font-semibold text-ink hover:bg-white ${
          wide ? "bg-white" : "bg-white/60"
        }`}
      >
        <Icon name="calendar_today" size={16} className="text-accent-ink" />
        {isToday && !wide ? `Today · ${dateLabel}` : dateLabel}
      </button>
      <button
        type="button"
        aria-label="Next day"
        title="Next day"
        disabled={isToday}
        onClick={() => {
          goTo(offset + 1);
        }}
        className="grid size-8 place-items-center rounded-sm text-ink-muted hover:bg-white/80 disabled:cursor-default disabled:bg-transparent disabled:text-ink-disabled"
      >
        <Icon name="chevron_right" size={18} />
      </button>
      {wide && !isToday && (
        <button
          type="button"
          onClick={() => {
            goTo(0);
          }}
          className="h-7 rounded-tile bg-accent/12 px-2.5 text-caption font-semibold text-accent-ink hover:bg-accent/20"
        >
          Back to today
        </button>
      )}
      <span className="flex-1" />
      {!wide && <span className="font-mono text-timer font-semibold">{formatDuration(total)}</span>}
      {wide && hasRows && copyButton}
    </div>
  );

  let body;
  if (status === "error") {
    body = <LoadError title="Couldn’t load this day’s sessions" subject="sessions" onRetry={reload} />;
  } else if (status === "loading") {
    body = (
      <div
        aria-busy="true"
        aria-label="Loading sessions"
        className={`flex-1 rounded-panel border border-white/85 ${wide ? "bg-white/60" : "bg-white/55"}`}
      />
    );
  } else if (sessions.length === 0) {
    body = <LogEmpty variant={variant} />;
  } else if (wide) {
    body = <WideTable sessions={sessions} now={now} />;
  } else {
    body = <NarrowTable sessions={sessions} now={now} />;
  }

  return (
    <div className={`relative z-1 flex min-h-0 flex-1 flex-col ${wide ? "" : "px-3 pb-3"}`}>
      {picker}
      {body}
      {!wide && hasRows && (
        <div className="flex shrink-0 flex-col gap-1.5 pt-2.5">
          {copyButton}
          <span aria-live="polite" className="min-h-3.5 text-center text-duration text-ink-muted">
            {copyHint}
          </span>
        </div>
      )}
      {wide && (
        <span aria-live="polite" className="sr-only">
          {copyHint}
        </span>
      )}
    </div>
  );
}

type TableProps = { sessions: readonly Session[]; now: number };

function TypeLabel({ session, size }: { session: Session; size: 13 | 14 }) {
  const style = TYPE_STYLES[session.taskType];
  return (
    <>
      <Icon name={style.icon} size={size} />
      <span className="whitespace-nowrap">{style.short}</span>
    </>
  );
}

/** 3f: task, type and client/project stacked; start – end; duration. */
function NarrowTable({ sessions, now }: TableProps) {
  const totals = totalsBySummary(sessions, now);
  const total = totalSeconds(sessions, now);
  const grid = "grid grid-cols-[1fr_92px_52px] gap-2";

  return (
    <div
      role="table"
      aria-label="Sessions"
      className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-panel border border-white/85 bg-white/55 backdrop-blur-glass"
    >
      <div
        role="row"
        className={`${grid} shrink-0 border-b border-ink-muted/12 px-3 pt-2.5 pb-1.5 text-micro tracking-[0.06em] text-ink-muted uppercase`}
      >
        <span role="columnheader">Task · type · client/project</span>
        <span role="columnheader">Start – end</span>
        <span role="columnheader" className="text-right">
          Dur.
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto [scrollbar-width:thin]">
        {sessions.map((session) => {
          const task = sessionDisplay(session);
          const style = TYPE_STYLES[task.type];
          const running = session.endedAt === null;
          return (
            <div
              key={session.id}
              role="row"
              className={`${grid} items-center border-b border-ink-muted/8 px-3 py-2 hover:bg-white/60`}
            >
              <div role="cell" className="flex min-w-0 flex-col gap-0.75">
                <span className="truncate text-ui-sm font-medium">{displayTitle(task)}</span>
                <span className={`flex min-w-0 items-center gap-1 text-duration font-semibold ${style.ink}`}>
                  <TypeLabel session={session} size={13} />
                  <span className="truncate font-normal text-ink-muted">· {whereLabel(task) ?? "—"}</span>
                </span>
              </div>
              <span role="cell" className="font-mono text-duration font-medium text-ink">
                {formatTimeRange(session.startedAt, session.endedAt)}
              </span>
              <span
                role="cell"
                className={`text-right font-mono text-caption font-semibold ${running ? "text-accent-ink" : "text-ink"}`}
              >
                {formatDuration(sessionSeconds(session, now))}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex shrink-0 flex-col gap-1.5 border-t border-ink-muted/12 bg-white/40 px-3 py-2.5">
        <div aria-hidden="true" className="flex h-2 gap-0.5 overflow-hidden rounded-[4px]">
          {SUMMARY_KEYS.filter((key) => totals[key] > 0).map((key) => (
            <span key={key} className={SUMMARY[key].bar} style={{ flexGrow: totals[key] }} />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-x-3.5 gap-y-1 text-meta">
          {SUMMARY_KEYS.map((key) => (
            <span key={key} className={`flex items-center gap-1.25 font-semibold ${SUMMARY[key].ink}`}>
              <Icon name={SUMMARY[key].icon} size={14} />
              {SUMMARY[key].label}
              <span className="flex-1" />
              <span className="font-mono font-medium text-ink">{formatDuration(totals[key])}</span>
            </span>
          ))}
          <span className="flex items-center gap-1.25 font-bold">
            Total
            <span className="flex-1" />
            <span className="font-mono">{formatDuration(total)}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

/** 3g: full columns. */
function WideTable({ sessions, now }: TableProps) {
  const totals = totalsBySummary(sessions, now);
  const total = totalSeconds(sessions, now);
  const grid = "grid grid-cols-[1.6fr_1fr_1fr_76px_76px_64px] gap-2.5";

  return (
    <div
      role="table"
      aria-label="Sessions"
      className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-panel border border-white/85 bg-white/60"
    >
      <div
        role="row"
        className={`${grid} shrink-0 border-b border-ink-muted/12 px-3.5 py-2.5 text-micro tracking-[0.06em] text-ink-muted uppercase`}
      >
        <span role="columnheader">Task</span>
        <span role="columnheader">Type</span>
        <span role="columnheader">Client / project</span>
        <span role="columnheader">Start</span>
        <span role="columnheader">End</span>
        <span role="columnheader" className="text-right">
          Duration
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto [scrollbar-width:thin]">
        {sessions.map((session, index) => {
          const task = sessionDisplay(session);
          const running = session.endedAt === null;
          return (
            <div
              key={session.id}
              role="row"
              className={`${grid} items-center px-3.5 py-2.25 text-ui-sm ${
                index < sessions.length - 1 ? "border-b border-ink-muted/8" : ""
              }`}
            >
              <span role="cell" className="truncate">
                {displayTitle(task)}
              </span>
              <span
                role="cell"
                className={`flex items-center gap-1 text-caption font-semibold ${TYPE_STYLES[task.type].ink}`}
              >
                <TypeLabel session={session} size={14} />
              </span>
              <span role="cell" className="truncate text-ink-muted">
                {whereLabel(task) ?? "—"}
              </span>
              <span role="cell" className="font-mono text-caption font-medium">
                {formatTimeOfDay(session.startedAt)}
              </span>
              <span role="cell" className="font-mono text-caption font-medium">
                {session.endedAt ? formatTimeOfDay(session.endedAt) : "now"}
              </span>
              <span
                role="cell"
                className={`text-right font-mono text-caption font-semibold ${running ? "text-accent-ink" : ""}`}
              >
                {formatDuration(sessionSeconds(session, now), { padMinutes: true })}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex shrink-0 items-center gap-4.5 border-t border-ink-muted/12 bg-white/45 px-3.5 py-3 text-caption">
        {SUMMARY_KEYS.map((key) => (
          <span key={key} className={`flex items-center gap-1.25 font-semibold ${SUMMARY[key].ink}`}>
            <Icon name={SUMMARY[key].icon} size={15} />
            {SUMMARY[key].label} <span className="font-mono font-medium text-ink">{formatDuration(totals[key])}</span>
          </span>
        ))}
        <span className="flex-1" />
        <span className="font-bold">
          Total <span className="font-mono">{formatDuration(total)}</span>
        </span>
      </div>
    </div>
  );
}
