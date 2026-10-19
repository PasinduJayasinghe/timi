import { useEffect, useState, type KeyboardEvent } from "react";
import { Icon } from "../../components/Icon";
import type { ToastMessage } from "../../components/Toast";
import type { CalendarEvent } from "../../data/calendar";
import { queueWrite } from "../../data/db";
import * as taskStore from "../../data/tasks";
import type { Task } from "../../data/types";
import { orderTasks } from "../../hooks/useTodayTasks";
import { addDays, formatShortDate, fromLocalDayKey } from "../../lib/date";
import { formatTimeOfDay } from "../../lib/duration";
import { formatMinutes, parseEstimate } from "../../lib/estimate";
import { minutesLeftForTasks } from "../../lib/shift";
import { displayMeta, displayTitle } from "../../lib/taskDisplay";
import { styleOf } from "../../lib/taskTypes";
import { MonthPicker } from "../calendar/DatePickers";
import { SheetActions, ShiftSheet } from "./ShiftSheet";

type Choice = { kind: "keep" } | { kind: "move"; day: string } | { kind: "drop" };

type PlanMyDaySheetProps = {
  variant: "expanded" | "wide";
  /** "start" opens from Start shift and ends with it; "review" is step 1 alone, from the leftovers chip. */
  mode: "start" | "review";
  todayKey: string;
  /** The day's task list (step 2). */
  tasks: readonly Task[];
  /** The day's calendar events (step 2). */
  events: readonly CalendarEvent[];
  onAdd: (title: string) => void;
  onEstimate: (id: string, minutes: number | null) => void;
  /** Leftovers were kept, moved or dropped: reload the list and the leftovers count. */
  onChanged: () => void;
  showToast: (toast: ToastMessage) => void;
  onStart: () => void;
  onClose: () => void;
};

const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? "" : "s"}`;

/** Plan my day (7d): review leftovers from the last shift, then plan this one and Start shift. */
export function PlanMyDaySheet({
  variant,
  mode,
  todayKey,
  tasks,
  events,
  onAdd,
  onEstimate,
  onChanged,
  showToast,
  onStart,
  onClose,
}: PlanMyDaySheetProps) {
  const [leftovers, setLeftovers] = useState<Task[] | "loading" | "error">("loading");
  const [choices, setChoices] = useState<ReadonlyMap<string, Choice>>(new Map());
  const [step, setStep] = useState<1 | 2>(1);
  const [loadCount, setLoadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLeftovers("loading");
    taskStore
      .leftovers(todayKey)
      .then((list) => {
        if (cancelled) return;
        setLeftovers(list);
        setChoices(new Map());
        // Nothing left over: straight to the plan
        if (mode === "start" && list.length === 0) setStep(2);
      })
      .catch((error: unknown) => {
        console.error("[plan] leftovers load failed", error);
        if (!cancelled) setLeftovers("error");
      });
    return () => {
      cancelled = true;
    };
  }, [todayKey, mode, loadCount]);

  const hasLeftovers = Array.isArray(leftovers) && leftovers.length > 0;
  const total = mode === "review" || !hasLeftovers ? 1 : 2;
  const choiceOf = (id: string): Choice => choices.get(id) ?? { kind: "keep" };
  const choose = (id: string, choice: Choice): void => {
    setChoices((map) => new Map(map).set(id, choice));
  };

  /** Applies step 1. Drops get one Undo toast. */
  const applyLeftovers = (): void => {
    if (!Array.isArray(leftovers) || leftovers.length === 0) return;
    const dropped = leftovers.filter((task) => choiceOf(task.id).kind === "drop");
    queueWrite(async () => {
      for (const task of leftovers) {
        const choice = choiceOf(task.id);
        if (choice.kind === "keep") await taskStore.moveToDay(task.id, todayKey);
        else if (choice.kind === "move") await taskStore.moveToDay(task.id, choice.day);
        else await taskStore.softDelete(task.id);
      }
    })
      .then(() => {
        onChanged();
        // What's left over now (nothing, unless Back is pressed after a failed save)
        setLoadCount((count) => count + 1);
      })
      .catch((error: unknown) => {
        console.error("[plan] leftovers save failed", error);
        showToast({
          message: "Couldn’t save that change. Try again.",
          tone: "error",
        });
        onChanged();
      });
    if (dropped.length > 0) {
      showToast({
        tone: "neutral",
        icon: "delete",
        message: `Dropped ${plural(dropped.length, "task")}`,
        action: {
          label: "Undo",
          onClick: () => {
            queueWrite(async () => {
              for (const task of dropped) await taskStore.restore(task.id);
            })
              .then(onChanged)
              .catch((error: unknown) => {
                console.error("[plan] undo failed", error);
              });
          },
        },
      });
    }
  };

  if (step === 1 || mode === "review") {
    return (
      <ShiftSheet
        title="Plan my day"
        icon="wb_sunny"
        iconClass="text-type-meeting-ink"
        variant={variant}
        onClose={onClose}
        steps={{ current: 1, total }}
      >
        <div className="flex shrink-0 flex-col gap-0.5">
          <span className="text-[15px] font-bold">Left over from your last shift</span>
          <span className="text-ui-sm leading-[1.45] text-ink-muted">
            Keep them for this shift, move them to another day, or drop them.
          </span>
        </div>
        <LeftoverList
          leftovers={leftovers}
          todayKey={todayKey}
          choiceOf={choiceOf}
          onChoose={choose}
          onRetry={() => {
            setLoadCount((count) => count + 1);
          }}
        />
        {mode === "review" ? (
          <SheetActions
            primary="Done"
            primaryIcon="check"
            onPrimary={() => {
              applyLeftovers();
              onClose();
            }}
            secondary="Cancel"
            onSecondary={onClose}
            autoFocus
          />
        ) : (
          <SheetActions
            primary="Next"
            primaryIcon="arrow_forward"
            onPrimary={() => {
              applyLeftovers();
              setStep(2);
            }}
            secondary="Skip"
            onSecondary={() => {
              setStep(2);
            }}
            autoFocus
          />
        )}
      </ShiftSheet>
    );
  }

  return (
    <ShiftSheet
      title="Plan my day"
      icon="wb_sunny"
      iconClass="text-type-meeting-ink"
      variant={variant}
      onClose={onClose}
      steps={{ current: total, total }}
    >
      <YourShift todayKey={todayKey} tasks={tasks} events={events} onAdd={onAdd} onEstimate={onEstimate} />
      <SheetActions
        primary="Start shift"
        primaryIcon="play_arrow"
        onPrimary={onStart}
        secondary={total > 1 ? "Back" : "Cancel"}
        onSecondary={() => {
          if (total > 1) setStep(1);
          else onClose();
        }}
      />
      <span className="-mt-2 shrink-0 text-center text-duration text-ink-muted">
        Shown when you start a shift · turn off in Settings
      </span>
    </ShiftSheet>
  );
}

type LeftoverListProps = {
  leftovers: Task[] | "loading" | "error";
  todayKey: string;
  choiceOf: (id: string) => Choice;
  onChoose: (id: string, choice: Choice) => void;
  onRetry: () => void;
};

function LeftoverList({ leftovers, todayKey, choiceOf, onChoose, onRetry }: LeftoverListProps) {
  const [pickerFor, setPickerFor] = useState<string | null>(null);

  if (leftovers === "loading") {
    return <div aria-busy="true" aria-label="Loading tasks" className="h-24 shrink-0 rounded-md bg-white/40" />;
  }
  if (leftovers === "error") {
    return (
      <div role="alert" className="flex shrink-0 items-center gap-2 rounded-md bg-status-error-surface px-3 py-2.5">
        <span className="flex-1 text-caption text-status-error">Couldn’t load the tasks left over.</span>
        <button
          type="button"
          onClick={onRetry}
          className="h-8 rounded-sm bg-white px-3 text-caption font-semibold text-status-error hover:bg-status-error-surface"
        >
          Try again
        </button>
      </div>
    );
  }
  if (leftovers.length === 0) {
    return <p className="m-0 text-ui-sm text-ink-muted">Nothing was left over. You’re all set.</p>;
  }

  return (
    <div className="flex shrink-0 flex-col gap-2">
      {leftovers.map((task) => {
        const style = styleOf(task);
        const choice = choiceOf(task.id);
        const moveDay = choice.kind === "move" ? choice.day : addDays(todayKey, 1);
        const options: Array<{ label: string; choice: Choice }> = [
          { label: "Keep", choice: { kind: "keep" } },
          { label: "Move", choice: { kind: "move", day: moveDay } },
          { label: "Drop", choice: { kind: "drop" } },
        ];
        return (
          <div key={task.id} className="flex flex-col gap-1.5 rounded-md border border-white bg-white/65 p-2.5">
            <div className="flex items-center gap-2">
              <span className={`grid size-6.5 shrink-0 place-items-center rounded-[8px] ${style.tint} ${style.ink}`}>
                <Icon name={style.icon} size={15} />
              </span>
              <div className="flex min-w-0 flex-1 flex-col leading-[1.25]">
                <span className="truncate text-ui-sm font-semibold">{displayTitle(task)}</span>
                <span className="truncate text-duration text-ink-muted">{displayMeta(task)}</span>
              </div>
            </div>
            <div className="relative flex items-center gap-2">
              <div
                role="radiogroup"
                aria-label={`${displayTitle(task)}: keep, move or drop`}
                className="inline-flex rounded-control bg-ink-muted/8 p-0.5"
              >
                {options.map((option) => {
                  const active = option.choice.kind === choice.kind;
                  return (
                    <button
                      key={option.label}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => {
                        onChoose(task.id, option.choice);
                        setPickerFor(option.choice.kind === "move" ? task.id : null);
                      }}
                      className={`h-8 rounded-sm px-2.5 text-meta ${
                        active
                          ? `bg-white font-semibold shadow-sm ${option.choice.kind === "drop" ? "text-status-error" : "text-ink"}`
                          : "font-medium text-ink-muted hover:text-ink"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
              {choice.kind === "move" && (
                <button
                  type="button"
                  aria-label={`Move to ${formatShortDate(fromLocalDayKey(choice.day))}, change the day`}
                  onClick={() => {
                    setPickerFor(pickerFor === task.id ? null : task.id);
                  }}
                  className="flex h-8 items-center gap-1 rounded-sm bg-accent-ink/10 px-2 text-meta font-semibold text-accent-ink hover:bg-accent-ink/16"
                >
                  <Icon name="calendar_today" size={13} />
                  to {formatShortDate(fromLocalDayKey(choice.day))}
                </button>
              )}
              {pickerFor === task.id && choice.kind === "move" && (
                <MonthPicker
                  selectedKey={choice.day}
                  todayKey={todayKey}
                  position="top-full left-0 mt-1"
                  onSelect={(key) => {
                    onChoose(task.id, key === todayKey ? { kind: "keep" } : { kind: "move", day: key });
                    setPickerFor(null);
                  }}
                  onClose={() => {
                    setPickerFor(null);
                  }}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

type YourShiftProps = Pick<PlanMyDaySheetProps, "todayKey" | "tasks" | "events" | "onAdd" | "onEstimate">;

/** Step 2: the shift's meetings, its tasks with estimates, and planned time against the hours left. */
function YourShift({ todayKey, tasks, events, onAdd, onEstimate }: YourShiftProps) {
  const [title, setTitle] = useState("");
  const now = Date.now();
  const meetings = events.filter((event) => event.endMs > now);
  const open = orderTasks(tasks).filter((task) => !task.completedAt);
  const leftMinutes = minutesLeftForTasks(todayKey, now, meetings);
  const plannedMinutes = open.reduce((sum, task) => sum + (task.estimateMinutes ?? 0), 0);
  const over = plannedMinutes - leftMinutes;
  const percent = leftMinutes > 0 ? Math.min(100, (plannedMinutes / leftMinutes) * 100) : plannedMinutes > 0 ? 100 : 0;

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const text = title.trim();
    if (!text) return;
    onAdd(text);
    setTitle("");
  };

  return (
    <>
      <div className="flex shrink-0 flex-col gap-0.5">
        <span className="text-[15px] font-bold">Your shift</span>
        <span className="text-ui-sm leading-[1.45] text-ink-muted">
          {meetings.length === 0 ? "No meetings." : `${plural(meetings.length, "meeting")}.`}{" "}
          {formatMinutes(Math.max(0, leftMinutes))} left for tasks.
        </span>
      </div>

      {meetings.map((event) => (
        <div
          key={event.id}
          className="flex h-10 shrink-0 items-center gap-2 rounded-control border border-type-calendar/35 bg-type-calendar/12 px-2.5"
        >
          <Icon name="videocam" size={15} className="text-type-calendar-ink" />
          <span className="min-w-0 flex-1 truncate text-ui-sm font-semibold">{event.title}</span>
          <span className="font-mono text-meta text-ink-muted">
            {formatTimeOfDay(new Date(event.startMs).toISOString())} –{" "}
            {formatTimeOfDay(new Date(event.endMs).toISOString())}
          </span>
        </div>
      ))}

      <div className="flex shrink-0 flex-col gap-0.5 rounded-md border border-white bg-white/65 px-3 pt-2 pb-3">
        <span className="flex h-7 items-center text-label text-ink-muted uppercase">Tasks · {open.length}</span>
        {open.map((task) => (
          <PlanRow key={task.id} task={task} onEstimate={onEstimate} />
        ))}
        <label className="mt-1 mb-2 flex h-9 items-center gap-1.5 rounded-control border border-ink-muted/18 bg-white px-2.5 focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-accent">
          <Icon name="add" size={16} className="text-accent-ink" />
          <input
            value={title}
            onChange={(event) => {
              setTitle(event.currentTarget.value);
            }}
            onKeyDown={onKeyDown}
            placeholder="Add a task, press Enter"
            aria-label="Add a task"
            data-autofocus
            className="min-w-0 flex-1 bg-transparent text-ui-sm text-ink placeholder:text-ink-placeholder focus-visible:outline-none"
          />
        </label>
        <div className="flex h-2 overflow-hidden rounded-[4px] bg-white/60">
          <span style={{ width: `${percent}%` }} className={over > 0 ? "bg-status-error-edge" : "bg-accent-gradient"} />
        </div>
        <span className={`mt-1 text-meta ${over > 0 ? "font-semibold text-status-error" : "text-ink-muted"}`}>
          {over > 0
            ? `Planned ${formatMinutes(plannedMinutes)} · ${formatMinutes(over)} more than you have`
            : `Planned ${plannedMinutes > 0 ? formatMinutes(plannedMinutes) : "0m"} of ${formatMinutes(
                Math.max(0, leftMinutes),
              )} · ${formatMinutes(Math.max(0, leftMinutes - plannedMinutes))} free`}
        </span>
      </div>
    </>
  );
}

function PlanRow({ task, onEstimate }: { task: Task; onEstimate: (id: string, minutes: number | null) => void }) {
  const style = styleOf(task);
  const [text, setText] = useState(task.estimateMinutes === null ? "" : formatMinutes(task.estimateMinutes));
  const [invalid, setInvalid] = useState(false);

  const save = (): void => {
    const minutes = parseEstimate(text);
    if (minutes === undefined) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setText(minutes === null ? "" : formatMinutes(minutes));
    if (minutes !== task.estimateMinutes) onEstimate(task.id, minutes);
  };

  return (
    <div className="flex min-h-9 items-center gap-2">
      <span className={`grid size-6 shrink-0 place-items-center rounded-[7px] ${style.tint} ${style.ink}`}>
        <Icon name={style.icon} size={14} />
      </span>
      <span className="min-w-0 flex-1 truncate text-ui-sm font-medium">{displayTitle(task)}</span>
      {task.carriedFrom && (
        <span className="flex shrink-0 items-center gap-0.5 rounded-xs bg-ink-muted/10 py-px pr-1.5 pl-1 text-meta font-medium text-type-other-ink">
          <Icon name="history" size={13} />
          kept
        </span>
      )}
      <input
        value={text}
        onChange={(event) => {
          setText(event.currentTarget.value);
        }}
        onBlur={save}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        placeholder="est"
        aria-label={`Estimate for ${displayTitle(task)}`}
        aria-invalid={invalid}
        className={`h-8 w-16 shrink-0 rounded-xs bg-white/90 px-1.5 text-center font-mono text-meta font-medium placeholder:font-sans placeholder:text-accent-ink ${
          invalid ? "border-[1.5px] border-status-error-edge" : "border border-ink-muted/18"
        }`}
      />
    </div>
  );
}
