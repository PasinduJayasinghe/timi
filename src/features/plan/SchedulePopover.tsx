import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { FieldError } from "../../components/FieldError";
import { Icon } from "../../components/Icon";
import type { Task } from "../../data/types";
import { formatMinutes } from "../../lib/estimate";
import { parseTimeOfDay } from "../../lib/reminder";
import { DEFAULT_BLOCK_MIN, LENGTHS_MIN, shortTime, timeOnDay } from "../../lib/schedule";
import { displayTitle } from "../../lib/taskDisplay";

type SchedulePopoverProps = {
  task: Task;
  dayKey: string;
  onSave: (startMs: number, minutes: number) => void;
  onUnschedule: () => void;
  onClose: () => void;
};

/** "Schedule …" (7b): the keyboard way to plan a task's time, with a start and a length. */
export function SchedulePopover({ task, dayKey, onSave, onUnschedule, onClose }: SchedulePopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [start, setStart] = useState(task.plannedStart ? shortTime(Date.parse(task.plannedStart)) : "");
  const [length, setLength] = useState<number>(task.plannedMinutes ?? task.estimateMinutes ?? DEFAULT_BLOCK_MIN);
  const [invalid, setInvalid] = useState(false);

  // Focus the start field on open; give focus back on close
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    ref.current?.querySelector<HTMLInputElement>("input")?.focus();
    return () => {
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  const time = parseTimeOfDay(start);
  const startMs = time ? timeOnDay(dayKey, time) : null;

  const save = (): void => {
    if (startMs === null) {
      setInvalid(true);
      return;
    }
    onSave(startMs, length);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    } else if (event.key === "Tab") {
      const focusable = ref.current?.querySelectorAll<HTMLElement>("button:not([disabled]), input");
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  };

  return (
    <div className="absolute inset-0 z-40 flex items-start justify-center pt-6">
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 animate-fade-in rounded-panel bg-ink/12" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={`Schedule ${displayTitle(task)}`}
        onKeyDown={onKeyDown}
        className="relative flex w-75 flex-col gap-3 rounded-xl border border-white bg-white/92 p-4 shadow-sheet backdrop-blur-sheet"
      >
        <div className="flex items-center gap-1.5">
          <Icon name="schedule" size={18} className="text-accent-ink" />
          <span className="min-w-0 flex-1 truncate text-ui font-bold">Schedule “{displayTitle(task)}”</span>
          <button
            type="button"
            aria-label="Close"
            title="Close"
            onClick={onClose}
            className="grid size-8 shrink-0 place-items-center rounded-sm bg-ink-muted/8 text-ink-muted hover:bg-ink-muted/16 hover:text-ink"
          >
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <label className="flex flex-col gap-1.25">
            <span className="text-meta font-semibold text-ink-muted">Start</span>
            <span
              className={`flex h-9.5 items-center gap-1.5 rounded-cta-sm bg-white px-2.5 focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-accent ${
                invalid ? "border-[1.5px] border-status-error-edge" : "border border-ink-muted/18"
              }`}
            >
              <Icon name="schedule" size={16} className="text-ink-muted" />
              <input
                value={start}
                placeholder="11 pm"
                aria-invalid={invalid}
                onChange={(event) => {
                  setStart(event.currentTarget.value);
                  setInvalid(false);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") save();
                }}
                className="min-w-0 flex-1 bg-transparent font-mono text-ui font-medium text-ink placeholder:font-sans placeholder:font-normal placeholder:text-ink-placeholder focus-visible:outline-none"
              />
            </span>
          </label>
          <div className="flex flex-col gap-1.25">
            <span className="text-meta font-semibold text-ink-muted">Ends</span>
            <span className="flex h-9.5 items-center rounded-cta-sm bg-ink-muted/6 px-2.5 font-mono text-ui text-ink-muted">
              {startMs === null ? "—" : shortTime(startMs + length * 60_000)}
            </span>
          </div>
        </div>
        {invalid && <FieldError>Type a time like 11 pm or 23:30</FieldError>}
        <div role="radiogroup" aria-label="Length" className="flex gap-1.5">
          {LENGTHS_MIN.map((minutes) => {
            const active = minutes === length;
            return (
              <button
                key={minutes}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => {
                  setLength(minutes);
                }}
                className={`h-8 flex-1 rounded-sm border font-mono text-caption ${
                  active
                    ? "border-accent-ink bg-accent/16 font-semibold text-accent-ink-hover"
                    : "border-ink-muted/18 bg-white font-medium hover:bg-white/70"
                }`}
              >
                {formatMinutes(minutes)}
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <button
            type="button"
            onClick={save}
            className="flex h-10 items-center justify-center gap-1.5 rounded-md bg-accent-gradient-strong text-ui font-semibold text-white shadow-copy focus-visible:outline-offset-3"
          >
            <Icon name="schedule" size={18} />
            Schedule
          </button>
          {task.plannedStart ? (
            <button
              type="button"
              onClick={onUnschedule}
              className="h-10 rounded-md bg-white/60 px-3.5 text-ui font-semibold text-ink-muted hover:bg-white hover:text-ink"
            >
              Unschedule
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-md bg-white/60 px-3.5 text-ui font-semibold text-ink-muted hover:bg-white hover:text-ink"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
