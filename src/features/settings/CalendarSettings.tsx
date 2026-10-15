import { Icon } from "../../components/Icon";
import type { CalendarState } from "../../hooks/useCalendar";
import { initials } from "../../lib/calendar";
import { formatTimeOfDay } from "../../lib/duration";

/** Settings > Google Calendar (4e): account, Disconnect, and calendars to include. */
export function CalendarSettings({ calendar }: { calendar: CalendarState }) {
  const { status } = calendar;
  if (!status) return null;

  const synced = status.syncedAtMs ? formatTimeOfDay(new Date(status.syncedAtMs).toISOString()) : null;
  let line: { text: string; healthy: boolean };
  if (status.problem === "auth") line = { text: "Sign in again to keep syncing", healthy: false };
  else if (status.problem)
    line = { text: synced ? `Couldn’t sync · last synced ${synced}` : "Couldn’t sync", healthy: false };
  else line = { text: synced ? `Connected · synced ${synced}` : "Connected · syncing…", healthy: true };

  const toggle = (id: string): void => {
    const ids = status.calendars.filter((c) => (c.id === id ? !c.included : c.included)).map((c) => c.id);
    calendar.setIncluded(ids);
  };

  return (
    <section aria-labelledby="settings-calendar" className="flex flex-col gap-1.5">
      <h2 id="settings-calendar" className="m-0 px-1 text-label tracking-[0.07em] text-ink-muted uppercase">
        Google Calendar
      </h2>
      <div className="flex flex-col rounded-lg border border-white/90 bg-white/60">
        {status.connected && status.email ? (
          <>
            <div className="flex min-h-14 items-center gap-2.5 border-b border-ink-muted/8 px-3 py-1.5">
              <span
                aria-hidden="true"
                className="grid size-8 shrink-0 place-items-center rounded-full bg-type-client/20 text-caption font-bold text-type-client-ink-strong"
              >
                {initials(status.email.split("@")[0] ?? "")}
              </span>
              <div className="min-w-0 flex-1 leading-[1.3]">
                <div className="truncate text-ui font-medium">{status.email}</div>
                <div
                  className={`flex items-center gap-1 text-meta ${line.healthy ? "text-status-success" : "text-status-error"}`}
                >
                  <span
                    aria-hidden="true"
                    className={`size-1.5 rounded-full ${line.healthy ? "bg-type-support" : "bg-status-error-edge"}`}
                  />
                  {line.text}
                </div>
              </div>
              <button
                type="button"
                onClick={calendar.disconnect}
                className="h-8 rounded-tile border border-type-calendar-ink/30 bg-white/70 px-2.5 text-caption font-semibold text-type-calendar-ink hover:bg-type-calendar/14"
              >
                Disconnect
              </button>
            </div>
            {status.calendars.length > 0 && (
              <>
                <div className="px-3 pt-2 pb-1 text-meta text-ink-muted">Calendars to include</div>
                {status.calendars.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="checkbox"
                    aria-checked={item.included}
                    onClick={() => {
                      toggle(item.id);
                    }}
                    className="flex min-h-10 items-center gap-2.5 px-3 text-left text-ui font-medium hover:bg-white/60"
                  >
                    <span
                      aria-hidden="true"
                      className={`grid size-4.5 shrink-0 place-items-center rounded-[5px] ${
                        item.included ? "bg-accent-ink text-white" : "border-[1.5px] border-ink-muted/50 bg-white"
                      }`}
                    >
                      {item.included && <Icon name="check" size={14} />}
                    </span>
                    {/* The calendar's own colour from Google */}
                    <span
                      aria-hidden="true"
                      style={{ background: item.color }}
                      className="size-2 shrink-0 rounded-full"
                    />
                    <span className="min-w-0 flex-1 truncate">{item.name}</span>
                  </button>
                ))}
                <div className="h-1.5" />
              </>
            )}
          </>
        ) : (
          <div className="flex min-h-14 items-center gap-2.5 px-3 py-1.5">
            <div className="flex-1 leading-[1.3]">
              <div className="text-ui font-medium">Not connected</div>
              <div className="text-meta text-ink-muted">
                {status.configured
                  ? calendar.connecting
                    ? "Finish signing in in your browser."
                    : "See meetings next to your work."
                  : "Google sign-in isn’t set up in this build yet."}
              </div>
            </div>
            <button
              type="button"
              onClick={calendar.connect}
              disabled={!status.configured || calendar.connecting}
              className="flex h-8 items-center gap-1 rounded-tile pr-3 pl-2 text-caption font-semibold text-white bg-accent-gradient-strong disabled:cursor-default disabled:opacity-60"
            >
              <Icon name="link" size={16} />
              Connect
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
