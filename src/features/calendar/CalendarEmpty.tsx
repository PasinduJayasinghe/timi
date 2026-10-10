import { Icon } from "../../components/Icon";

type CalendarEmptyProps = {
  className?: string;
};

/**
 * 3c "not connected" state. Phase 0: Connect is inert; Google sign-in arrives with Phase 5.
 * The 3c rose blob is drawn by the container (WindowFrame or the wide pane) so it isn't clipped mid-window.
 */
export function CalendarEmpty({ className = "" }: CalendarEmptyProps) {
  return (
    <div className={`relative flex flex-col justify-center gap-3 ${className}`}>
      <span className="relative grid size-11 place-items-center rounded-md border border-white bg-white/75 text-type-calendar-ink">
        <Icon name="calendar_month" size={24} />
      </span>
      <h2 className="relative m-0 text-heading">See meetings next to your work</h2>
      <p className="relative m-0 text-ui leading-[1.55] font-normal text-pretty text-ink-muted">
        Connect Google Calendar to get meeting alerts, one-click Meet joins and meetings on your timeline. Timi only reads
        events — it never edits them.
      </p>
      <button
        type="button"
        aria-disabled="true"
        className="relative mt-1 flex h-11 items-center gap-2 self-start rounded-md pr-4 pl-3 text-body font-semibold text-white shadow-cta-lg bg-accent-gradient-strong hover:-translate-y-px"
      >
        <Icon name="link" size={19} />
        Connect Google Calendar
      </button>
      <span className="relative text-meta text-ink-muted">Opens your browser to sign in.</span>
    </div>
  );
}
