import { Icon } from "../../components/Icon";
import { useToast } from "../../components/Toast";
import { openMeet, type Attendee, type CalendarEvent, type CalendarStatus } from "../../data/calendar";
import { formatSpan, initials, startsIn } from "../../lib/calendar";
import { formatTimeOfDay } from "../../lib/duration";

/** Avatar colours from 3a, as type tints; "+3" uses the neutral one. */
const AVATAR_STYLES = [
  "bg-type-client/20 text-type-client-ink-strong",
  "bg-type-internal/20 text-type-internal-ink-strong",
  "bg-type-support/20 text-type-support-ink-strong",
];

/** Attendee initials, overlapping (3a). The signed-in user is left out. */
export function Avatars({ attendees, max = 3 }: { attendees: readonly Attendee[]; max?: number }) {
  const others = attendees.filter((attendee) => !attendee.isSelf);
  if (others.length === 0) return null;
  const shown = others.slice(0, max);
  const extra = others.length - shown.length;
  const circle = "grid size-6 place-items-center rounded-full border-2 border-white text-[9.5px] font-bold";
  return (
    <div className="flex" aria-label={`${others.length} ${others.length === 1 ? "person" : "people"}`}>
      {shown.map((attendee, index) => (
        <span
          key={`${attendee.name}-${index}`}
          title={attendee.name}
          aria-hidden="true"
          className={`${circle} ${index > 0 ? "-ml-1.75" : ""} ${AVATAR_STYLES[index % AVATAR_STYLES.length]}`}
        >
          {initials(attendee.name)}
        </span>
      ))}
      {extra > 0 && (
        <span aria-hidden="true" className={`${circle} -ml-1.75 bg-type-other/20 text-type-other-ink-strong`}>
          +{extra}
        </span>
      )}
    </div>
  );
}

type JoinVariant = "primary" | "compact" | "pane";

const JOIN_STYLES: Record<JoinVariant, string> = {
  // 3a next meeting: "Join Google Meet"
  primary:
    "h-8 gap-1 pr-2.5 pl-2 rounded-sm bg-type-calendar-ink text-meta text-white hover:bg-type-calendar-ink-strong",
  // 3a other meetings: "Join"
  compact: "h-8 px-2.25 rounded-tile bg-white/75 text-duration text-type-calendar-ink hover:bg-white",
  // 1d wide pane: "Join Meet"
  pane: "h-8 px-2.25 rounded-[8px] bg-type-calendar-ink text-duration text-white hover:bg-type-calendar-ink-strong",
};

const JOIN_LABEL: Record<JoinVariant, string> = { primary: "Join Google Meet", compact: "Join", pane: "Join Meet" };

/** Opens the meeting's Google Meet link in the browser. */
export function JoinButton({ event, variant }: { event: CalendarEvent; variant: JoinVariant }) {
  const toast = useToast();
  const { meetUrl } = event;
  if (!meetUrl) return null;
  return (
    <button
      type="button"
      aria-label={`Join Google Meet: ${event.title}`}
      onClick={() => {
        openMeet(meetUrl).catch((error: unknown) => {
          console.error("[calendar] join failed", error);
          toast({ message: "Couldn’t open Google Meet. Try again.", tone: "error" });
        });
      }}
      className={`flex shrink-0 items-center font-semibold ${JOIN_STYLES[variant]}`}
    >
      {variant === "primary" && <Icon name="videocam" size={16} />}
      {JOIN_LABEL[variant]}
    </button>
  );
}

/** "12:30–1:15 am · in 48m" (3a). */
export function eventTiming(event: CalendarEvent, nowMs: number): string {
  const when = startsIn(event, nowMs);
  return when ? `${formatSpan(event.startMs, event.endMs)} · ${when}` : formatSpan(event.startMs, event.endMs);
}

/** Account and connection (3a header, 3c footer): a green dot when synced, orange after a failed sync. */
export function AccountChip({ status }: { status: CalendarStatus }) {
  const healthy = status.problem === null;
  return (
    <span
      title={healthy ? "Google Calendar connected" : "Google Calendar couldn’t sync"}
      className="flex min-w-0 items-center gap-1.25 text-meta text-ink-muted"
    >
      <span
        aria-hidden="true"
        className={`size-[7px] shrink-0 rounded-full ${healthy ? "bg-type-support shadow-connected" : "bg-status-error-edge"}`}
      />
      <span className="truncate">{status.email}</span>
    </span>
  );
}

/** "Couldn’t sync calendar" (3c), or a sign-in-again alert when Google revoked access (drafted). */
export function SyncProblemAlert({
  status,
  onRetry,
  onReconnect,
}: {
  status: CalendarStatus;
  onRetry: () => void;
  onReconnect: () => void;
}) {
  if (status.problem === null) return null;
  const auth = status.problem === "auth";
  const since = status.syncedAtMs ? formatTimeOfDay(new Date(status.syncedAtMs).toISOString()) : null;
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-md border border-status-error-edge/25 bg-status-error-surface/90 p-3"
    >
      <Icon name="sync_problem" size={20} className="text-status-error" />
      <div className="flex flex-1 flex-col gap-0.75">
        <span className="text-ui font-semibold">
          {auth ? "Sign in to Google Calendar again" : "Couldn’t sync calendar"}
        </span>
        <span className="text-caption leading-[1.45] text-ink-muted">
          {auth
            ? "Google stopped Timi’s access. Reconnect to keep meetings up to date."
            : since
              ? `Showing events from ${since}.`
              : "Showing the events Timi already has."}
        </span>
      </div>
      <button
        type="button"
        onClick={auth ? onReconnect : onRetry}
        disabled={status.syncing}
        className="flex h-8 items-center gap-1 rounded-sm border border-status-error-edge/30 bg-white px-3 text-caption font-semibold text-status-error hover:bg-status-error-surface disabled:opacity-60"
      >
        <Icon name={auth ? "link" : "refresh"} size={16} />
        {auth ? "Reconnect" : "Retry"}
      </button>
    </div>
  );
}
