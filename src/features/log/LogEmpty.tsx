type LogEmptyProps = {
  /** "expanded" follows 3f; "wide" follows 3g. */
  variant?: "expanded" | "wide";
};

/**
 * Log card for a day with no sessions. Not in the design: the empty message was drafted for
 * Phase 0 and approved with the plan.
 */
export function LogEmpty({ variant = "expanded" }: LogEmptyProps) {
  return (
    <div
      className={`flex min-h-0 flex-1 flex-col justify-center gap-2.5 overflow-hidden rounded-panel border border-white/85 px-7 ${
        variant === "wide" ? "bg-white/60" : "bg-white/55 backdrop-blur-glass"
      }`}
    >
      <h2 className="m-0 text-display">Nothing logged yet.</h2>
      <p className="m-0 text-body leading-[1.55] font-normal text-pretty text-ink-muted">
        Start a timer on a task and each session shows up here with its start, end and duration — ready to copy into
        your timesheet.
      </p>
    </div>
  );
}
