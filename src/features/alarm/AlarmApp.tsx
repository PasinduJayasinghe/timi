import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { listen } from "@tauri-apps/api/event";
import { Icon } from "../../components/Icon";
import { IconButton } from "../../components/IconButton";
import { alarm, MEETING_LEADS, type AlarmInfo, type MeetingPrefs } from "../../data/calendar";
import { useNow } from "../../hooks/useNow";
import { alarmProgress, formatCountdown } from "../../lib/calendar";
import { playChime } from "../../lib/chime";
import { formatTimeOfDay } from "../../lib/duration";
import { startDrag } from "../../lib/window";

const iso = (ms: number): string => new Date(ms).toISOString();

const onDragArea = (event: MouseEvent<HTMLElement>): void => {
  if (event.button === 0) void startDrag();
};

/** "Starts at 12:30 am · 45 min · 6 people" (4a). */
function startsLine(info: AlarmInfo): string {
  const { event } = info;
  const minutes = Math.round((event.endMs - event.startMs) / 60_000);
  const parts = [`Starts at ${formatTimeOfDay(iso(event.startMs))}`, `${minutes} min`];
  if (event.attendees.length > 0)
    parts.push(`${event.attendees.length} ${event.attendees.length === 1 ? "person" : "people"}`);
  return parts.join(" · ");
}

/**
 * The meeting alarm window (4a), and the meeting timer offer after Join (4b). Rust opens it and
 * keeps the alarm state; this window only shows it and sends the user's choices back.
 */
export function AlarmApp() {
  const [info, setInfo] = useState<AlarmInfo | null>(null);
  const [joined, setJoined] = useState(false);
  const now = useNow(true);

  const load = useCallback((ring: boolean): void => {
    alarm
      .info()
      .then((next) => {
        setInfo(next);
        setJoined(false);
        if (ring && next?.prefs.chime) playChime();
      })
      .catch((error: unknown) => {
        console.error("[alarm] load failed", error);
      });
  }, []);

  useEffect(() => {
    load(true);
    // A snoozed meeting coming back, or another meeting, rings again
    const unlisten = listen("alarm-changed", () => {
      load(true);
    });
    return () => {
      void unlisten.then((stop) => {
        stop();
      });
    };
  }, [load]);

  const setPrefs = (prefs: MeetingPrefs): void => {
    setInfo((current) => (current ? { ...current, prefs } : current));
    alarm.setPrefs(prefs).catch((error: unknown) => {
      console.error("[alarm] prefs failed", error);
    });
  };

  const run = (action: () => Promise<unknown>): void => {
    action().catch((error: unknown) => {
      console.error("[alarm] action failed", error);
    });
  };

  // Esc: Dismiss (4a) or Not now (4b)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") run(alarm.dismiss);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <div
      role="alertdialog"
      aria-label={joined ? "Track this meeting?" : "Meeting starting soon"}
      className="relative flex h-screen w-screen flex-col gap-3 overflow-hidden rounded-xl bg-alarm px-4.5 pt-4 pb-3.5 text-ink"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-22.5 -right-20 size-60 rounded-full bg-type-calendar opacity-38 blur-blob-xs"
      />
      {!joined && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-22.5 -left-20 size-55 rounded-full bg-blob-violet opacity-35 blur-blob-xs"
        />
      )}
      {info &&
        (joined ? (
          <Offer info={info} onPrefs={setPrefs} run={run} />
        ) : (
          <Alarm
            info={info}
            now={now}
            onPrefs={setPrefs}
            run={run}
            onJoined={() => {
              setJoined(true);
            }}
          />
        ))}
    </div>
  );
}

type ViewProps = {
  info: AlarmInfo;
  onPrefs: (prefs: MeetingPrefs) => void;
  run: (action: () => Promise<unknown>) => void;
};

/** 4a: countdown, Join Google Meet, Snooze 2 min, Dismiss, and the lead time. */
function Alarm({ info, now, onPrefs, run, onJoined }: ViewProps & { now: number; onJoined: () => void }) {
  const { event, prefs } = info;
  const started = now >= event.startMs;
  const progress = alarmProgress(event.startMs, prefs.leadMinutes, now);

  return (
    <>
      <div onMouseDown={onDragArea} className="relative flex cursor-grab items-center gap-2">
        <span className="flex h-6.5 items-center gap-1.25 rounded-[13px] bg-white/70 pr-2.5 pl-2 text-meta font-semibold text-type-calendar-ink">
          <Icon name="notifications_active" size={15} fill />
          Meeting soon
        </span>
        <span className="flex-1" />
        <IconButton
          icon={prefs.chime ? "volume_up" : "volume_off"}
          label={prefs.chime ? "Chime on" : "Chime off"}
          aria-pressed={prefs.chime}
          onMouseDown={(e) => {
            e.stopPropagation();
          }}
          onClick={() => {
            onPrefs({ ...prefs, chime: !prefs.chime });
          }}
          className="hover:bg-white/70"
        />
      </div>

      <div className="relative flex items-end gap-3.5">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h1 className="m-0 line-clamp-2 text-heading leading-[1.25]">{event.title}</h1>
          <span className="text-ui-sm text-ink-muted">{startsLine(info)}</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-micro tracking-[0.06em] text-ink-muted">{started ? "NOW" : "IN"}</span>
          <span
            aria-live="off"
            className="font-mono text-timer-lg leading-none font-semibold tracking-[-0.02em] text-type-calendar-ink tabular-nums"
          >
            {formatCountdown(event.startMs - now)}
          </span>
        </div>
      </div>

      <div aria-hidden="true" className="relative h-1 overflow-hidden rounded-[2px] bg-type-calendar-ink/12">
        <div
          style={{ width: `${progress * 100}%` }}
          className="h-full rounded-[2px] bg-alarm-progress transition-[width] duration-1000 ease-linear"
        />
      </div>

      {event.meetUrl && (
        <button
          type="button"
          // The main action of the alarm
          autoFocus
          onClick={() => {
            alarm
              .join()
              .then((autoStarted) => {
                if (!autoStarted) onJoined();
              })
              .catch((error: unknown) => {
                console.error("[alarm] join failed", error);
              });
          }}
          className="relative flex h-12 shrink-0 items-center justify-center gap-2 rounded-md bg-type-calendar-ink text-[14px] font-semibold text-white shadow-join hover:bg-type-calendar-ink-strong focus-visible:outline-offset-3"
        >
          <Icon name="videocam" size={20} fill />
          Join Google Meet
        </button>
      )}

      <div className="relative grid shrink-0 grid-cols-2 gap-2">
        <button
          type="button"
          autoFocus={!event.meetUrl}
          onClick={() => {
            run(alarm.snooze);
          }}
          className="flex h-10 items-center justify-center gap-1.5 rounded-control border border-white/90 bg-white/70 text-ui font-semibold text-ink hover:bg-white"
        >
          <Icon name="snooze" size={17} />
          Snooze 2 min
        </button>
        <button
          type="button"
          onClick={() => {
            run(alarm.dismiss);
          }}
          className="h-10 rounded-control border border-white/90 bg-white/40 text-ui font-semibold text-ink-muted hover:bg-white/80 hover:text-ink"
        >
          Dismiss
        </button>
      </div>

      <div className="relative flex items-center gap-1.5 text-meta text-ink-muted">
        <span id="alarm-lead" className="flex-1">
          Alert me before
        </span>
        <div role="radiogroup" aria-labelledby="alarm-lead" className="flex gap-1.5">
          {MEETING_LEADS.map((minutes) => {
            const active = prefs.leadMinutes === minutes;
            return (
              <button
                key={minutes}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={`${minutes} minute${minutes === 1 ? "" : "s"}`}
                onClick={() => {
                  onPrefs({ ...prefs, leadMinutes: minutes });
                }}
                className={`h-8 min-w-9.5 rounded-tile border font-mono text-meta font-medium ${
                  active
                    ? "border-type-calendar-ink bg-type-calendar-ink/12 text-type-calendar-ink-strong"
                    : "border-white/90 bg-white/55 text-ink hover:bg-white/80"
                }`}
              >
                {minutes}m
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

/** 4b: after Join, offer a meeting timer that stops when the event ends. */
function Offer({ info, onPrefs, run }: ViewProps) {
  const { event, prefs, runningTitle } = info;
  return (
    <>
      <div
        onMouseDown={onDragArea}
        className="relative flex cursor-grab items-center gap-2 text-caption font-semibold text-status-success"
      >
        <Icon name="check_circle" size={17} fill />
        Opened Google Meet in your browser
      </div>
      <h1 className="relative m-0 text-title">Track this meeting?</h1>
      <p className="relative m-0 text-ui leading-[1.5] text-pretty text-ink-muted">
        Start a Meeting timer for <b className="font-semibold text-ink">{event.title}</b>.
        {runningTitle && (
          <>
            {" "}
            <b className="font-semibold text-ink">{runningTitle}</b> will pause and save.
          </>
        )}
      </p>
      <div className="relative flex items-center gap-2.5 rounded-md border border-white bg-white/65 px-3 py-2.5">
        <span className="grid size-7.5 shrink-0 place-items-center rounded-tile bg-type-calendar/22 text-type-calendar-ink">
          <Icon name="videocam" size={17} />
        </span>
        <div className="flex-1 leading-[1.25]">
          <div className="text-ui-sm font-semibold">Meeting</div>
          <div className="text-duration text-ink-muted">
            Ends {formatTimeOfDay(iso(event.endMs))} — timer stops when the event ends
          </div>
        </div>
      </div>
      <div className="relative grid grid-cols-[1fr_auto] gap-2">
        <button
          type="button"
          autoFocus
          onClick={() => {
            run(alarm.startTimer);
          }}
          className="flex h-11 items-center justify-center gap-1.5 rounded-md text-body font-semibold text-white shadow-cta-lg bg-accent-gradient-strong hover:-translate-y-px"
        >
          <Icon name="play_arrow" size={20} fill />
          Start meeting timer
        </button>
        <button
          type="button"
          onClick={() => {
            run(alarm.dismiss);
          }}
          className="h-11 rounded-md bg-white/60 px-4 text-ui font-semibold text-ink-muted hover:bg-white/90 hover:text-ink"
        >
          Not now
        </button>
      </div>
      <button
        type="button"
        role="checkbox"
        aria-checked={prefs.autoStart}
        onClick={() => {
          onPrefs({ ...prefs, autoStart: !prefs.autoStart });
        }}
        className="relative flex min-h-8 items-center gap-2 self-start rounded-xs text-caption text-ink-muted hover:text-ink"
      >
        <span
          aria-hidden="true"
          className={`grid size-4.5 place-items-center rounded-[5px] ${
            prefs.autoStart ? "bg-accent-ink text-white" : "border-[1.5px] border-ink-muted/50 bg-white"
          }`}
        >
          {prefs.autoStart && <Icon name="check" size={14} />}
        </span>
        Always start automatically when I join
      </button>
    </>
  );
}
