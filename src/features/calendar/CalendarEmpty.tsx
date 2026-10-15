import { Icon } from "../../components/Icon";
import type { ConnectError } from "../../data/calendar";
import type { CalendarState } from "../../hooks/useCalendar";

type CalendarEmptyProps = {
  calendar: CalendarState;
  className?: string;
};

/** Why sign-in didn't finish (drafted). */
const CONNECT_ERRORS: Record<ConnectError, string> = {
  "not-configured": "Google sign-in isn’t set up in this build yet.",
  cancelled: "Sign-in didn’t finish. Try again.",
  network: "Couldn’t reach Google. Check your connection and try again.",
};

/**
 * 3c "not connected" state. The 3c rose blob is drawn by the container (WindowFrame or the
 * wide pane) so it isn't clipped mid-window.
 */
export function CalendarEmpty({ calendar, className = "" }: CalendarEmptyProps) {
  const { connecting, connectError } = calendar;
  const notConfigured = calendar.status?.configured === false;
  const error = notConfigured ? "not-configured" : connectError;

  return (
    <div className={`relative flex flex-col justify-center gap-3 ${className}`}>
      <span className="relative grid size-11 place-items-center rounded-md border border-white bg-white/75 text-type-calendar-ink">
        <Icon name="calendar_month" size={24} />
      </span>
      <h2 className="relative m-0 text-heading">See meetings next to your work</h2>
      <p className="relative m-0 text-ui leading-[1.55] font-normal text-pretty text-ink-muted">
        Connect Google Calendar to get meeting alerts, one-click Meet joins and meetings on your timeline. Timi only
        reads events — it never edits them.
      </p>
      <button
        type="button"
        onClick={calendar.connect}
        disabled={connecting || notConfigured}
        className="relative mt-1 flex h-11 items-center gap-2 self-start rounded-md pr-4 pl-3 text-body font-semibold text-white shadow-cta-lg bg-accent-gradient-strong hover:-translate-y-px disabled:translate-y-0 disabled:cursor-default disabled:opacity-60"
      >
        <Icon name="link" size={19} />
        {connecting ? "Waiting for sign-in…" : "Connect Google Calendar"}
      </button>
      {error ? (
        <span role="alert" className="relative flex items-center gap-1 text-meta font-medium text-status-error">
          <Icon name="error" size={14} />
          {CONNECT_ERRORS[error]}
        </span>
      ) : (
        <span className="relative text-meta text-ink-muted">
          {connecting ? "Finish signing in in your browser." : "Opens your browser to sign in."}
        </span>
      )}
    </div>
  );
}
