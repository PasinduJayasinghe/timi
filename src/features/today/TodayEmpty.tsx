import { Icon } from "../../components/Icon";
import { formatTimeOfDay } from "../../lib/duration";

type TodayEmptyProps = {
  className?: string;
  /** Today's next meeting, if any (1b). */
  nextMeeting?: { title: string; startMs: number } | null;
};

/** 1b empty state: new day, nothing carried over. */
export function TodayEmpty({ className = "", nextMeeting = null }: TodayEmptyProps) {
  return (
    <div className={`flex flex-col justify-center gap-2.5 ${className}`}>
      <h2 className="m-0 text-display">A clean slate.</h2>
      <p className="m-0 text-body leading-[1.55] font-normal text-pretty text-ink-muted">
        Nothing was left over from yesterday. Type your first task above and press Enter — or hit Start task to get a
        timer going straight away.
      </p>
      <div className="mt-2.5 flex flex-col gap-2 text-caption text-ink-muted">
        <div className="flex items-center gap-2">
          <kbd className="rounded-xs border border-ink-muted/18 bg-white/70 px-1.5 py-0.75 font-mono text-duration font-semibold text-ink">
            Ctrl Shift Space
          </kbd>
          Quick add from any app
        </div>
        {nextMeeting && (
          <div className="flex items-center gap-2">
            <Icon name="videocam" size={16} className="text-type-calendar-ink" />
            Next meeting · {nextMeeting.title} at {formatTimeOfDay(new Date(nextMeeting.startMs).toISOString())}
          </div>
        )}
      </div>
    </div>
  );
}
