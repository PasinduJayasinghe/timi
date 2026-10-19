import { Icon } from "../../components/Icon";
import { formatShortDate, fromLocalDayKey } from "../../lib/date";
import { formatDuration } from "../../lib/duration";
import { formatMinutes } from "../../lib/estimate";
import type { DayLoad } from "../../lib/plan";

/** Planned work (violet) and meetings (rose) against the working hours (7a). Orange when over. */
export function DayLoadBar({ load, className = "" }: { load: DayLoad; className?: string }) {
  const over = load.overMinutes > 0;
  const percent = (minutes: number): string => `${Math.min(100, (minutes / load.spanMinutes) * 100)}%`;
  const parts = [`Planned ${load.plannedMinutes > 0 ? formatMinutes(load.plannedMinutes) : "0m"}`];
  if (load.meetingMinutes > 0) parts.push(`meetings ${formatMinutes(load.meetingMinutes)}`);
  parts.push(
    over
      ? `${formatMinutes(load.overMinutes)} more than you have`
      : `${formatMinutes(load.freeMinutes)} free of ${formatMinutes(load.spanMinutes)}`,
  );

  return (
    <div className={`relative z-1 flex shrink-0 flex-col gap-1.25 ${className}`}>
      <div aria-hidden="true" className="flex h-2 gap-0.5 overflow-hidden rounded-[4px] bg-white/60">
        <span
          style={{ width: percent(load.plannedMinutes) }}
          className={over ? "bg-status-error-edge" : "bg-accent-gradient"}
        />
        {load.meetingMinutes > 0 && (
          <span style={{ width: percent(load.meetingMinutes) }} className="bg-type-calendar" />
        )}
      </div>
      <span className={`text-meta ${over ? "font-semibold text-status-error" : "text-ink-muted"}`}>
        {parts.join(" · ")}
      </span>
    </div>
  );
}

type PastDaySummaryProps = {
  dayKey: string;
  planned: number | null;
  doneCount: number | null;
  trackedSeconds: number | null;
  className?: string;
};

/** A past day on the Plan tab (7h): a read-only summary; the Log has the detail. */
export function PastDaySummary({
  dayKey,
  planned,
  doneCount,
  trackedSeconds,
  className = "mx-3",
}: PastDaySummaryProps) {
  const title = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" }).format(
    fromLocalDayKey(dayKey),
  );
  const tiles = [
    { label: "Planned", value: planned === null ? "…" : `${planned} ${planned === 1 ? "task" : "tasks"}` },
    { label: "Done", value: doneCount === null || planned === null ? "…" : `${doneCount} of ${planned}` },
    { label: "Tracked", value: trackedSeconds === null ? "…" : formatDuration(trackedSeconds) },
  ];
  return (
    <section
      aria-label={`${formatShortDate(fromLocalDayKey(dayKey))} summary`}
      className={`relative z-1 flex shrink-0 flex-col gap-2 rounded-lg border border-white/85 bg-white/55 px-3 py-2.5 backdrop-blur-glass ${className}`}
    >
      <div className="flex items-center gap-1.5">
        <Icon name="history" size={16} className="text-ink-muted" />
        <span className="flex-1 text-ui font-semibold">{title}</span>
        <span className="rounded-xs bg-ink-muted/10 px-1.5 py-px text-meta font-medium text-type-other-ink">
          Past day
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {tiles.map((tile) => (
          <div key={tile.label} className="flex flex-col gap-0.5 rounded-control bg-white/60 p-2">
            <span className="text-label font-normal tracking-normal text-ink-muted">{tile.label}</span>
            <span className="font-mono text-[14px] font-semibold">{tile.value}</span>
          </div>
        ))}
      </div>
      <span className="text-meta text-ink-muted">
        Past days are a read-only summary. Unfinished tasks wait for Plan my day; the Log has every session.
      </span>
    </section>
  );
}

/** An empty future day (7h). */
export function PlanEmpty({ dayKey, className = "mx-3 mt-2.5" }: { dayKey: string; className?: string }) {
  const name = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" }).format(
    fromLocalDayKey(dayKey),
  );
  return (
    <div
      className={`relative z-1 flex flex-col gap-2 rounded-lg border border-white/85 bg-white/55 px-4 py-3.5 ${className}`}
    >
      <span className="text-heading">Nothing planned yet.</span>
      <span className="text-ui leading-[1.55] text-ink-muted">Add tasks for {name} above.</span>
    </div>
  );
}
