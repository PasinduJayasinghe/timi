import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Icon } from "../../components/Icon";
import { TypeTile } from "../../components/TypeTile";
import type { CalendarEvent } from "../../data/calendar";
import type { Task } from "../../data/types";
import { useNow } from "../../hooks/useNow";
import { orderTasks } from "../../hooks/useTodayTasks";
import { formatMinutes } from "../../lib/estimate";
import {
  blockSpan,
  DEFAULT_BLOCK_MIN,
  plannedRange,
  resizedLength,
  shortTime,
  startAt,
  workWindow,
  type TimeWindow,
} from "../../lib/schedule";
import { displayTitle } from "../../lib/taskDisplay";
import { styleOf } from "../../lib/taskTypes";
import { SchedulePopover } from "./SchedulePopover";

type ScheduleViewProps = {
  dayKey: string;
  isToday: boolean;
  tasks: readonly Task[];
  events: readonly CalendarEvent[];
  /** Saves a planned time, or clears it with nulls. */
  onSchedule: (id: string, startMs: number | null, minutes: number | null) => void;
  variant: "expanded" | "wide";
};

type Drag = {
  kind: "new" | "move" | "resize";
  taskId: string;
  length: number;
  /** Minutes between the block's top and the pointer when the drag began ("move"). */
  grab: number;
  /** The block's start, for "resize". */
  startMs: number;
  originX: number;
  originY: number;
  /** True once the pointer has moved enough to count as a drag rather than a click. */
  moved: boolean;
  preview: { startMs: number; length: number } | null;
};

const MINUTE = 60_000;
const DRAG_THRESHOLD_PX = 4;

const lengthOf = (task: Task): number => Math.max(15, task.plannedMinutes ?? task.estimateMinutes ?? DEFAULT_BLOCK_MIN);

/** Time-blocking a day (7b): an Unscheduled tray, then Planned and Google Calendar lanes over the working hours. */
export function ScheduleView({ dayKey, isToday, tasks, events, onSchedule, variant }: ScheduleViewProps) {
  const hourPx = variant === "wide" ? 40 : 44;
  const win = workWindow(dayKey);
  const hours = (win.endMs - win.startMs) / (60 * MINUTE);
  const laneRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const [editing, setEditing] = useState<Task | null>(null);
  const now = useNow(isToday, 60_000);

  const open = orderTasks(tasks).filter((task) => !task.completedAt);
  const unscheduled = open.filter((task) => !task.plannedStart);
  const scheduled = tasks.filter((task) => task.plannedStart && task.plannedMinutes);

  const setDragState = (next: Drag | null): void => {
    dragRef.current = next;
    setDrag(next);
  };

  /** Minutes from the window's start at a pointer's height, or null when it's outside the lanes. */
  const minutesAt = (clientX: number, clientY: number): number | null => {
    const lane = laneRef.current?.getBoundingClientRect();
    if (!lane || clientX < lane.left - 40 || clientX > lane.right + 40) return null;
    if (clientY < lane.top - 20 || clientY > lane.bottom + 20) return null;
    return ((clientY - lane.top) / hourPx) * 60;
  };

  // Pointer moves are followed on the window, so a drag can leave the element it started on
  useEffect(() => {
    if (!drag) return;
    const onMove = (event: PointerEvent): void => {
      const current = dragRef.current;
      if (!current) return;
      const moved =
        current.moved ||
        Math.abs(event.clientX - current.originX) + Math.abs(event.clientY - current.originY) > DRAG_THRESHOLD_PX;
      if (!moved) return;
      const minutes = minutesAt(event.clientX, event.clientY);
      let preview: Drag["preview"] = null;
      if (minutes !== null) {
        if (current.kind === "resize") {
          const top = (current.startMs - win.startMs) / MINUTE;
          preview = { startMs: current.startMs, length: resizedLength(win, current.startMs, minutes - top) };
        } else {
          preview = { startMs: startAt(win, minutes - current.grab, current.length), length: current.length };
        }
      }
      setDragState({ ...current, moved, preview });
    };
    const onUp = (): void => {
      const current = dragRef.current;
      setDragState(null);
      if (!current) return;
      if (!current.moved) {
        const task = tasks.find((t) => t.id === current.taskId);
        if (task) setEditing(task);
        return;
      }
      if (current.preview) onSchedule(current.taskId, current.preview.startMs, current.preview.length);
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setDragState(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("keydown", onKey);
    };
    // Listeners follow the drag that started them; its state is read from dragRef
  }, [drag !== null]);

  const begin = (
    event: ReactPointerEvent,
    kind: Drag["kind"],
    task: Task,
    extra: Partial<Pick<Drag, "grab" | "startMs">> = {},
  ): void => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    setDragState({
      kind,
      taskId: task.id,
      length: lengthOf(task),
      grab: extra.grab ?? 0,
      startMs: extra.startMs ?? 0,
      originX: event.clientX,
      originY: event.clientY,
      moved: false,
      preview: null,
    });
  };

  const position = (startMs: number, minutes: number): { top: number; height: number } | null => {
    const span = blockSpan(win, startMs, minutes);
    return span ? { top: (span.top / 60) * hourPx, height: (span.length / 60) * hourPx - 3 } : null;
  };

  const nowTop = isToday && now >= win.startMs && now <= win.endMs ? ((now - win.startMs) / 3_600_000) * hourPx : null;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex shrink-0 flex-col gap-1.5">
        <div className="flex items-center">
          <span className="flex-1 text-label text-ink-muted uppercase">Unscheduled · {unscheduled.length}</span>
          <span className="text-duration text-ink-muted">
            {unscheduled.length > 0 ? "Drag into a time, or click" : "Everything has a time"}
          </span>
        </div>
        {unscheduled.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {unscheduled.map((task) => {
              const dragging = drag?.taskId === task.id && drag.moved;
              return (
                <button
                  key={task.id}
                  type="button"
                  onPointerDown={(event) => {
                    begin(event, "new", task);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setEditing(task);
                    }
                  }}
                  aria-label={`Schedule ${displayTitle(task)}`}
                  className={`flex h-10 max-w-full touch-none items-center gap-1.5 rounded-control border border-white bg-white/75 pr-2.5 pl-1.5 shadow-sm hover:bg-white ${
                    dragging ? "opacity-45" : ""
                  }`}
                >
                  <Icon name="drag_indicator" size={15} className="text-ink-muted/50" />
                  <TypeTile task={task} />
                  <span className="truncate text-caption font-medium">{displayTitle(task)}</span>
                  <span className="font-mono text-duration text-ink-muted">{formatMinutes(lengthOf(task))}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid shrink-0 grid-cols-[34px_1fr_1fr] gap-2 text-micro tracking-[0.06em] text-ink-muted uppercase">
        <span />
        <span>Planned</span>
        <span>Google Calendar</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pt-1.5 [scrollbar-width:thin]">
        <div className="relative grid grid-cols-[34px_1fr_1fr] gap-2" style={{ height: hours * hourPx }}>
          {/* Hour lines and labels */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            {Array.from({ length: Math.ceil(hours) }, (_, index) => (
              <div key={index} className="absolute inset-x-0 flex" style={{ top: index * hourPx }}>
                <span className="w-8.5 -translate-y-1.5 font-mono text-[10px] font-medium text-ink-muted">
                  {shortTime(win.startMs + index * 60 * MINUTE).replace(" ", "")}
                </span>
                <span className="flex-1 border-t border-ink-muted/14" />
              </div>
            ))}
          </div>
          <span />
          <div ref={laneRef} className="relative" aria-label="Planned">
            {scheduled.map((task) => {
              const start = Date.parse(task.plannedStart ?? "");
              const minutes = task.plannedMinutes ?? 0;
              const dragged = drag?.taskId === task.id && drag.moved && drag.preview;
              const shown = dragged && drag.preview ? drag.preview : { startMs: start, length: minutes };
              const place = position(shown.startMs, shown.length);
              if (!place) return null;
              const style = styleOf(task);
              const short = shown.length <= 30;
              return (
                <div
                  key={task.id}
                  style={{ top: place.top, height: place.height }}
                  className={`absolute inset-x-0 overflow-hidden rounded-tile border ${style.bar} ${
                    task.completedAt ? "opacity-55" : ""
                  } ${dragged ? "z-2 shadow-bar-hover" : ""}`}
                >
                  <button
                    type="button"
                    onPointerDown={(event) => {
                      const minutesNow = minutesAt(event.clientX, event.clientY) ?? 0;
                      begin(event, "move", task, { grab: minutesNow - (shown.startMs - win.startMs) / MINUTE });
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setEditing(task);
                      }
                    }}
                    aria-label={`${displayTitle(task)}, planned ${plannedRange(shown.startMs, shown.length)}. Press Enter to change`}
                    className={`flex size-full touch-none cursor-grab flex-col items-start px-2 text-left ${
                      short ? "flex-row items-center gap-1.5" : "pt-1"
                    }`}
                  >
                    <span className="flex min-w-0 max-w-full items-center gap-1 text-caption font-semibold">
                      <Icon name={style.icon} size={13} />
                      <span className="truncate">{displayTitle(task)}</span>
                    </span>
                    <span className="font-mono text-[10px] font-medium whitespace-nowrap opacity-85">
                      {short ? formatMinutes(shown.length) : plannedRange(shown.startMs, shown.length)}
                    </span>
                  </button>
                  <span
                    aria-hidden="true"
                    title="Drag to change the length"
                    onPointerDown={(event) => {
                      begin(event, "resize", task, { startMs: start });
                    }}
                    className="absolute inset-x-0 bottom-0 flex h-2 cursor-ns-resize touch-none justify-center"
                  >
                    <span className="mt-0.5 h-0.75 w-5.5 rounded-[2px] bg-current opacity-50" />
                  </span>
                </div>
              );
            })}
            {drag?.kind === "new" && drag.preview && (
              <DropPreview win={win} preview={drag.preview} position={position} />
            )}
          </div>
          <div className="relative" aria-label="Google Calendar">
            {events.map((event) => {
              const place = position(event.startMs, (event.endMs - event.startMs) / MINUTE);
              if (!place) return null;
              return (
                <div
                  key={event.id}
                  style={{ top: place.top, height: Math.max(place.height, 26) }}
                  className="absolute inset-x-0 overflow-hidden rounded-tile border border-type-calendar/50 bg-type-calendar/16 px-2 py-0.5"
                >
                  <span className="flex items-center gap-1 text-caption font-semibold">
                    <Icon name="videocam" size={13} className="text-type-calendar-ink" />
                    <span className="truncate">{event.title}</span>
                  </span>
                  <span className="font-mono text-[10px] text-ink-muted">
                    {shortTime(event.startMs)} – {shortTime(event.endMs)}
                  </span>
                </div>
              );
            })}
          </div>
          {nowTop !== null && (
            <div
              aria-hidden="true"
              style={{ top: nowTop }}
              className="pointer-events-none absolute right-0 left-7.5 h-0.5 bg-accent-ink"
            >
              <span className="absolute -top-0.75 -left-1 size-2 rounded-full bg-accent-ink" />
            </div>
          )}
        </div>
      </div>

      {editing && (
        <SchedulePopover
          task={editing}
          dayKey={dayKey}
          onSave={(startMs, minutes) => {
            onSchedule(editing.id, startMs, minutes);
            setEditing(null);
          }}
          onUnschedule={() => {
            onSchedule(editing.id, null, null);
            setEditing(null);
          }}
          onClose={() => {
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function DropPreview({
  win,
  preview,
  position,
}: {
  win: TimeWindow;
  preview: { startMs: number; length: number };
  position: (startMs: number, minutes: number) => { top: number; height: number } | null;
}) {
  const place = position(preview.startMs, preview.length);
  if (!place || preview.startMs < win.startMs) return null;
  return (
    <div
      aria-hidden="true"
      style={{ top: place.top, height: place.height }}
      className="pointer-events-none absolute inset-x-0 rounded-tile border-[1.5px] border-dashed border-accent-ink bg-accent/12"
    >
      <span className="absolute top-1.5 left-1.5 rounded-sm bg-ink px-2 py-0.5 font-mono text-[10.5px] font-semibold text-white">
        {plannedRange(preview.startMs, preview.length)}
      </span>
    </div>
  );
}
