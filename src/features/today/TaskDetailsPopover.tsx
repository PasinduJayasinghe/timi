import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { Icon } from "../../components/Icon";
import { FieldError } from "../../components/FieldError";
import { createClient, createProject, listClients, listProjects } from "../../data/catalog";
import type { TaskPatch } from "../../data/tasks";
import type { Task } from "../../data/types";
import type { NamePatch } from "../../hooks/useTodayTasks";
import { formatMinutes, parseEstimate } from "../../lib/estimate";
import { isValidTicketNumber, patchForTypeChange } from "../../lib/taskDisplay";
import { TASK_TYPES, TYPE_FIELDS, TYPE_STYLES, isTaskType } from "../../lib/taskTypes";
import { Picker, type PickerOption } from "./pickers/Picker";

type TaskDetailsPopoverProps = {
  task: Task;
  /** What the popover points at: a task row or a timeline bar. */
  anchor: HTMLElement;
  onClose: () => void;
  onUpdate: (patch: TaskPatch, names?: NamePatch) => void;
  onDelete: () => void;
};

type OpenPicker = "type" | "client" | "project" | null;

const NONE_ID = "__none__";
const GAP = 10;
const EDGE = 8;
/** Width beside a narrow anchor such as a timeline bar: the popover's width on an expanded-window row. */
const NARROW_WIDTH = 348;
/** Arrow position on a row (2d: 56px from the popover's left edge). */
const ROW_ARROW_LEFT = 56;

type Placement = { style: CSSProperties; arrow: "top" | "bottom" | null; arrowLeft: number };

/**
 * Places the popover under its anchor (or above it when there isn't room). On a row it is inset
 * 4px from the row (2d); beside a narrower anchor, such as a timeline bar, it is centred on the
 * anchor, kept inside the window, and its arrow points at the anchor.
 */
function usePlacement(anchor: HTMLElement, popover: RefObject<HTMLDivElement | null>) {
  const [placement, setPlacement] = useState<Placement>({
    style: { visibility: "hidden" },
    arrow: null,
    arrowLeft: ROW_ARROW_LEFT,
  });

  useLayoutEffect(() => {
    const place = (): void => {
      const element = popover.current;
      if (!element) return;
      const row = anchor.getBoundingClientRect();
      const height = element.offsetHeight;
      const viewport = window.innerHeight;
      let horizontal = { left: row.left + 4, width: row.width - 8 };
      let arrowLeft = ROW_ARROW_LEFT;
      if (horizontal.width < NARROW_WIDTH) {
        const width = Math.min(NARROW_WIDTH, window.innerWidth - 2 * EDGE);
        const center = row.left + row.width / 2;
        const left = Math.min(Math.max(center - width / 2, EDGE), window.innerWidth - EDGE - width);
        horizontal = { left, width };
        // The arrow is 12px wide; keep it clear of the rounded corners
        arrowLeft = Math.min(Math.max(center - left - 6, 16), width - 28);
      }

      if (row.bottom + GAP + height <= viewport - EDGE) {
        setPlacement({ style: { ...horizontal, top: row.bottom + GAP }, arrow: "top", arrowLeft });
      } else if (row.top - GAP - height >= EDGE) {
        setPlacement({ style: { ...horizontal, top: row.top - GAP - height }, arrow: "bottom", arrowLeft });
      } else {
        const top = Math.max(EDGE, viewport - EDGE - height);
        setPlacement({ style: { ...horizontal, top, maxHeight: viewport - 2 * EDGE }, arrow: null, arrowLeft });
      }
    };

    place();
    const observer = new ResizeObserver(place);
    if (popover.current) observer.observe(popover.current);
    window.addEventListener("resize", place);
    document.addEventListener("scroll", place, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", place);
      document.removeEventListener("scroll", place, true);
    };
  }, [anchor, popover]);

  return placement;
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="text-meta font-semibold text-ink-muted">{children}</span>;
}

const CHIP = "flex h-6.5 items-center rounded-[8px] text-caption";
const NEUTRAL_CHIP = `${CHIP} bg-ink-muted/8 px-2.25 font-medium hover:bg-ink-muted/14`;

/** Task details popover (2d). Reminder, Sessions, the timer button and the "…" menu arrive in later phases. */
export function TaskDetailsPopover({ task, anchor, onClose, onUpdate, onDelete }: TaskDetailsPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { style, arrow, arrowLeft } = usePlacement(anchor, ref);
  const typeStyle = TYPE_STYLES[task.type];
  const fields = TYPE_FIELDS[task.type];

  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes);
  const [estimate, setEstimate] = useState(task.estimateMinutes === null ? "" : formatMinutes(task.estimateMinutes));
  const [estimateError, setEstimateError] = useState(false);
  const [ticket, setTicket] = useState<string | null>(null);
  const [ticketError, setTicketError] = useState(false);
  const [picker, setPicker] = useState<OpenPicker>(null);

  const [clients, setClients] = useState<PickerOption[] | null>(null);
  const [projects, setProjects] = useState<PickerOption[] | null>(null);
  const [catalogError, setCatalogError] = useState(false);

  // Keep the latest save function for the notes flush on close
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;
  const savedNotes = useRef(task.notes);
  const latestNotes = useRef(notes);
  latestNotes.current = notes;

  useEffect(() => {
    ref.current?.focus();
  }, []);

  // Notes save 500ms after typing stops
  useEffect(() => {
    if (notes === savedNotes.current) return;
    const timeoutId = window.setTimeout(() => {
      savedNotes.current = notes;
      onUpdateRef.current({ notes });
    }, 500);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [notes]);

  // ...and on close
  useEffect(() => {
    return () => {
      if (latestNotes.current !== savedNotes.current) onUpdateRef.current({ notes: latestNotes.current });
    };
  }, []);

  // Esc and clicks outside close the popover
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onClose();
    };
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target as Node;
      if (!ref.current?.contains(target) && !anchor.contains(target)) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [anchor, onClose]);

  // Load the catalog list when a client or project picker opens
  useEffect(() => {
    if (picker !== "client" && picker !== "project") return;
    let cancelled = false;
    setCatalogError(false);
    const load = async (): Promise<void> => {
      if (picker === "client") {
        const list = await listClients();
        if (!cancelled) setClients(list.map((c) => ({ id: c.id, label: c.name })));
      } else {
        const kind = fields.project === "internal" ? "internal" : "client";
        const list = await listProjects(kind, task.clientId);
        if (!cancelled) setProjects(list.map((p) => ({ id: p.id, label: p.name })));
      }
    };
    load().catch((error: unknown) => {
      console.error("[catalog] load failed", error);
      if (!cancelled) setCatalogError(true);
    });
    return () => {
      cancelled = true;
    };
  }, [picker, fields.project, task.clientId]);

  const saveTitle = (): void => {
    const next = title.trim();
    if (next === "") setTitle(task.title);
    else if (next !== task.title) onUpdate({ title: next });
  };

  const saveEstimate = (): void => {
    const minutes = parseEstimate(estimate);
    if (minutes === undefined) {
      setEstimateError(true);
      return;
    }
    setEstimateError(false);
    setEstimate(minutes === null ? "" : formatMinutes(minutes));
    if (minutes !== task.estimateMinutes) onUpdate({ estimateMinutes: minutes });
  };

  const saveTicket = (): void => {
    if (ticket === null) return;
    const value = ticket.trim();
    if (value !== "" && !isValidTicketNumber(value)) {
      setTicketError(true);
      return;
    }
    setTicketError(false);
    setTicket(null);
    const next = value === "" ? null : value;
    if (next !== task.ticketNumber) onUpdate({ ticketNumber: next });
  };

  const chooseType = (id: string): void => {
    setPicker(null);
    if (!isTaskType(id) || id === task.type) return;
    const patch = patchForTypeChange(task, id);
    onUpdate(patch, {
      clientName: patch.clientId ? task.clientName : null,
      projectName: null,
    });
  };

  const chooseClient = (id: string, name: string | null): void => {
    setPicker(null);
    const clientId = id === NONE_ID ? null : id;
    if (clientId === task.clientId) return;
    // A client project belongs to one client, so changing client clears it
    onUpdate({ clientId, projectId: null }, { clientName: clientId ? name : null, projectName: null });
  };

  const chooseProject = (id: string, name: string): void => {
    setPicker(null);
    if (id !== task.projectId) onUpdate({ projectId: id }, { projectName: name });
  };

  const onCatalogFailure = (error: unknown): void => {
    console.error("[catalog] create failed", error);
    setCatalogError(true);
  };

  const clientOptions: PickerOption[] = [
    ...(fields.client === "optional" ? [{ id: NONE_ID, label: "None" }] : []),
    ...(clients ?? []),
  ];

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Task details"
      tabIndex={-1}
      style={style}
      className="fixed z-40 flex flex-col gap-3.5 overflow-y-auto rounded-xl border border-white bg-white/90 p-4 text-ink shadow-lg backdrop-blur-sheet focus-visible:outline-none"
    >
      {arrow && (
        <div
          aria-hidden="true"
          style={{ left: arrowLeft }}
          className={`absolute size-3 rotate-45 bg-white ${arrow === "top" ? "-top-1.5" : "-bottom-1.5"}`}
        />
      )}

      <input
        value={title}
        onChange={(event) => {
          setTitle(event.currentTarget.value);
        }}
        onBlur={saveTitle}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        aria-label={task.type === "support" ? "Subject" : "Task title"}
        className="-mx-1 rounded-xs bg-transparent px-1 text-title tracking-title text-ink focus-visible:outline-offset-0"
      />

      <div className="-mt-1.5 flex flex-col gap-1.5">
        <div className="flex flex-wrap gap-1.5">
          {/* Type */}
          <span className="relative">
            <button
              type="button"
              aria-haspopup="listbox"
              aria-expanded={picker === "type"}
              onClick={() => {
                setPicker(picker === "type" ? null : "type");
              }}
              className={`${CHIP} gap-1 pr-2.25 pl-1.75 font-semibold hover:brightness-95 ${typeStyle.chipSoft} ${typeStyle.ink}`}
            >
              <Icon name={typeStyle.icon} size={15} />
              {typeStyle.label}
            </button>
            {picker === "type" && (
              <Picker
                label="Task type"
                options={TASK_TYPES.map((type) => ({
                  id: type,
                  label: TYPE_STYLES[type].label,
                  icon: TYPE_STYLES[type].icon,
                  iconClass: TYPE_STYLES[type].ink,
                }))}
                selectedId={task.type}
                selectedClass={typeStyle.pickerActive}
                checkClass={typeStyle.ink}
                onSelect={chooseType}
                onClose={() => {
                  setPicker(null);
                }}
              />
            )}
          </span>

          {/* Ticket number (support) */}
          {fields.ticket &&
            (ticket === null ? (
              <button
                type="button"
                onClick={() => {
                  setTicket(task.ticketNumber ?? "");
                }}
                aria-label="Ticket number"
                className={`${NEUTRAL_CHIP} ${task.ticketNumber ? "font-mono text-ink" : "text-ink-placeholder"}`}
              >
                {task.ticketNumber ? `#${task.ticketNumber}` : "Ticket number"}
              </button>
            ) : (
              <span
                className={`${CHIP} gap-0.5 border-[1.5px] bg-white px-2 font-mono ${
                  ticketError ? "border-status-error-edge" : "border-accent"
                }`}
              >
                <span className="text-ink-muted">#</span>
                <input
                  autoFocus
                  value={ticket}
                  inputMode="numeric"
                  aria-label="Ticket number"
                  aria-invalid={ticketError}
                  onChange={(event) => {
                    setTicket(event.currentTarget.value);
                  }}
                  onBlur={saveTicket}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") event.currentTarget.blur();
                    if (event.key === "Escape") {
                      event.stopPropagation();
                      event.nativeEvent.stopImmediatePropagation();
                      setTicket(null);
                      setTicketError(false);
                    }
                  }}
                  className="w-16 bg-transparent text-ink focus-visible:outline-none"
                />
              </span>
            ))}

          {/* Client */}
          {fields.client !== "none" && (
            <span className="relative">
              <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={picker === "client"}
                aria-label={`Client: ${task.clientName ?? "none"}`}
                onClick={() => {
                  setPicker(picker === "client" ? null : "client");
                }}
                className={`${NEUTRAL_CHIP} ${task.clientName ? "text-ink" : "text-ink-placeholder"}`}
              >
                {task.clientName ?? "Choose a client"}
              </button>
              {picker === "client" && (
                <Picker
                  label="Client"
                  options={clientOptions}
                  status={catalogError ? "error" : clients === null ? "loading" : "ready"}
                  selectedId={task.clientId ?? (fields.client === "optional" ? NONE_ID : null)}
                  selectedClass={typeStyle.pickerActive}
                  checkClass={typeStyle.ink}
                  filterable
                  filterPlaceholder="Choose a client"
                  createNoun="client"
                  onSelect={(id) => {
                    chooseClient(id, clientOptions.find((o) => o.id === id)?.label ?? null);
                  }}
                  onCreate={(name) => {
                    createClient(name)
                      .then((client) => {
                        chooseClient(client.id, client.name);
                      })
                      .catch(onCatalogFailure);
                  }}
                  onClose={() => {
                    setPicker(null);
                  }}
                />
              )}
            </span>
          )}

          {/* Project */}
          {fields.project !== "none" && (
            <span className="relative">
              <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={picker === "project"}
                aria-label={`Project: ${task.projectName ?? "none"}`}
                aria-disabled={fields.project === "client" && !task.clientId}
                title={fields.project === "client" && !task.clientId ? "Choose a client first" : undefined}
                onClick={() => {
                  if (fields.project === "client" && !task.clientId) return;
                  setPicker(picker === "project" ? null : "project");
                }}
                className={`${NEUTRAL_CHIP} ${task.projectName ? "text-ink" : "text-ink-placeholder"}`}
              >
                {task.projectName ?? "Choose a project"}
              </button>
              {picker === "project" && (
                <Picker
                  label="Project"
                  options={projects ?? []}
                  status={catalogError ? "error" : projects === null ? "loading" : "ready"}
                  selectedId={task.projectId}
                  selectedClass={typeStyle.pickerActive}
                  checkClass={typeStyle.ink}
                  filterable
                  filterPlaceholder="Choose a project"
                  createNoun="project"
                  onSelect={(id) => {
                    chooseProject(id, projects?.find((o) => o.id === id)?.label ?? "");
                  }}
                  onCreate={(name) => {
                    const kind = fields.project === "internal" ? "internal" : "client";
                    createProject(name, kind, task.clientId)
                      .then((project) => {
                        chooseProject(project.id, project.name);
                      })
                      .catch(onCatalogFailure);
                  }}
                  onClose={() => {
                    setPicker(null);
                  }}
                />
              )}
            </span>
          )}
        </div>
        {ticketError && <FieldError>Ticket numbers are digits only</FieldError>}
      </div>

      <label className="flex flex-col gap-1.25">
        <FieldLabel>Notes</FieldLabel>
        <textarea
          value={notes}
          onChange={(event) => {
            setNotes(event.currentTarget.value);
          }}
          rows={3}
          className="min-h-16 resize-none rounded-control border border-ink-muted/14 bg-app-from/60 px-3 py-2.25 text-ui leading-normal font-normal text-ink focus-visible:outline-offset-1"
        />
      </label>

      <div className="grid grid-cols-2 gap-2.5">
        <label className="flex flex-col gap-1.25">
          <FieldLabel>Estimate</FieldLabel>
          <span
            className={`flex h-9.5 items-center gap-1.5 rounded-cta-sm bg-white px-2.5 focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-accent ${
              estimateError ? "border-[1.5px] border-status-error-edge" : "border border-ink-muted/18"
            }`}
          >
            <Icon name="timer" size={16} className="text-ink-muted" />
            <input
              value={estimate}
              placeholder="None"
              aria-invalid={estimateError}
              onChange={(event) => {
                setEstimate(event.currentTarget.value);
              }}
              onBlur={saveEstimate}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
              className="min-w-0 flex-1 bg-transparent font-mono text-ui font-medium text-ink placeholder:font-sans placeholder:text-ink-placeholder focus-visible:outline-none"
            />
          </span>
        </label>
      </div>
      {estimateError && (
        <div className="-mt-2">
          <FieldError>Use minutes or hours, like 45m or 1h 30m</FieldError>
        </div>
      )}
      {catalogError && picker === null && <FieldError>Couldn’t save the client or project. Try again.</FieldError>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onDelete}
          className="flex h-10 items-center gap-1.5 rounded-control bg-type-calendar/12 px-3 text-ui font-semibold text-type-calendar-ink hover:bg-type-calendar/20"
        >
          <Icon name="delete" size={17} />
          Delete
        </button>
      </div>
    </div>
  );
}
