import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { FieldError } from "../../components/FieldError";
import { Icon } from "../../components/Icon";
import { createClient, createProject, listClients, listProjects } from "../../data/catalog";
import { recentTasks, type RecentTask } from "../../data/sessions";
import type { Task } from "../../data/types";
import type { TaskDraft } from "../../hooks/useTodayTasks";
import { relativeDayLabel, workDayKey } from "../../lib/date";
import { parseEstimate } from "../../lib/estimate";
import { displayMeta, displayTitle, isValidTicketNumber } from "../../lib/taskDisplay";
import { TYPE_STYLES } from "../../lib/taskTypes";
import type { PickerOption } from "../today/pickers/Picker";
import { ComboField, type CatalogRef } from "./ComboField";

type SheetType = "client" | "internal" | "support";

const SHEET_TYPES: readonly SheetType[] = ["client", "internal", "support"];

/** Button label per type (2a script). */
const START_LABEL: Record<SheetType, string> = {
  client: "Start client task",
  internal: "Start internal task",
  support: "Start ticket",
};

/** Shown under the disabled button (2b; client and support follow the same pattern). */
const MISSING_HINT: Record<SheetType, string> = {
  client: "Disabled until a client, project and title are set",
  internal: "Disabled until a project and title are set",
  support: "Disabled until a ticket number and subject are set",
};

const ESTIMATES = [
  { label: "15m", minutes: 15 },
  { label: "30m", minutes: 30 },
  { label: "1h", minutes: 60 },
  { label: "2h", minutes: 120 },
] as const;

type Estimate = (typeof ESTIMATES)[number]["label"] | "Custom" | null;

const RECENT_COUNT = 3;

type StartTaskSheetProps = {
  /** "expanded" fills the window below 72px (2a); "wide" fills the Today pane. */
  variant: "expanded" | "wide";
  todayKey: string;
  /** The running task, if any: hidden from Recent, and the hint says it will pause. */
  runningTaskId: string | null;
  onStart: (draft: TaskDraft) => void;
  onReplay: (task: Task) => void;
  onClose: () => void;
};

const toOptions = (items: ReadonlyArray<{ id: string; name: string }>): PickerOption[] =>
  items.map((item) => ({ id: item.id, label: item.name }));

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.25">
      <span className="text-meta font-semibold text-ink-muted">
        {label}
        {hint && <span className="font-normal">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

const fieldBox = (error: boolean): string =>
  `flex h-10 items-center gap-2 rounded-control px-3 focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-accent ${
    error ? "border-[1.5px] border-status-error-edge bg-white" : "border border-ink-muted/18 bg-white/85"
  }`;

const INPUT =
  "min-w-0 flex-1 bg-transparent text-body font-normal text-ink placeholder:text-ink-placeholder focus-visible:outline-none";

/** Start task sheet (2a, with the 2b picker and 2c error states): adds a task to today and starts its timer. */
export function StartTaskSheet({ variant, todayKey, runningTaskId, onStart, onReplay, onClose }: StartTaskSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [type, setType] = useState<SheetType>("client");

  // Each type keeps its own values while you switch between them (2a script)
  const [client, setClient] = useState<{ client: CatalogRef | null; project: CatalogRef | null; title: string }>({
    client: null,
    project: null,
    title: "",
  });
  const [internal, setInternal] = useState<{ project: CatalogRef | null; title: string }>({ project: null, title: "" });
  const [support, setSupport] = useState<{ ticket: string; subject: string; client: CatalogRef | null }>({
    ticket: "",
    subject: "",
    client: null,
  });
  const [estimate, setEstimate] = useState<Estimate>(null);
  const [customEstimate, setCustomEstimate] = useState("");
  const [recent, setRecent] = useState<RecentTask[]>([]);

  const style = TYPE_STYLES[type];

  // Focus the first field on open; give focus back to the button that opened the sheet on close
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    sheetRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    return () => {
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    recentTasks(RECENT_COUNT + 1)
      .then((list) => {
        if (!cancelled) setRecent(list.filter((item) => item.task.id !== runningTaskId).slice(0, RECENT_COUNT));
      })
      .catch((error: unknown) => {
        // Recent is a shortcut; the sheet works without it
        console.error("[start] recent load failed", error);
      });
    return () => {
      cancelled = true;
    };
  }, [runningTaskId]);

  const loadClients = useCallback(async () => toOptions(await listClients()), []);
  const clientId = client.client?.id ?? null;
  const loadClientProjects = useCallback(async () => toOptions(await listProjects("client", clientId)), [clientId]);
  const loadInternalProjects = useCallback(async () => toOptions(await listProjects("internal", null)), []);

  const ticket = support.ticket.trim();
  const ticketInvalid = ticket !== "" && !isValidTicketNumber(ticket);
  const customMinutes = estimate === "Custom" ? parseEstimate(customEstimate) : null;
  const estimateInvalid = estimate === "Custom" && customMinutes === undefined;
  const estimateMinutes =
    estimate === "Custom" ? (customMinutes ?? null) : (ESTIMATES.find((e) => e.label === estimate)?.minutes ?? null);

  let draft: TaskDraft | null = null;
  if (type === "client" && client.client && client.project && client.title.trim()) {
    draft = {
      type,
      title: client.title.trim(),
      clientId: client.client.id,
      clientName: client.client.name,
      projectId: client.project.id,
      projectName: client.project.name,
    };
  } else if (type === "internal" && internal.project && internal.title.trim()) {
    draft = { type, title: internal.title.trim(), projectId: internal.project.id, projectName: internal.project.name };
  } else if (type === "support" && ticket && !ticketInvalid && support.subject.trim()) {
    draft = {
      type,
      title: support.subject.trim(),
      ticketNumber: ticket,
      clientId: support.client?.id ?? null,
      clientName: support.client?.name ?? null,
    };
  }
  const ready = draft !== null && !estimateInvalid;

  const submit = (): void => {
    if (!draft || estimateInvalid) return;
    onStart({ ...draft, estimateMinutes });
    onClose();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === "Enter" && event.ctrlKey) {
      event.preventDefault();
      submit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    } else if (event.key === "Tab") {
      // Keep focus inside the sheet
      const focusable = sheetRef.current?.querySelectorAll<HTMLElement>(
        "button:not([disabled]), input:not([disabled]), [tabindex='0']",
      );
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

  const onTypeKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const index = SHEET_TYPES.indexOf(type);
    const next = SHEET_TYPES[(index + (event.key === "ArrowRight" ? 1 : SHEET_TYPES.length - 1)) % SHEET_TYPES.length];
    setType(next);
    event.currentTarget.parentElement?.querySelector<HTMLElement>(`[data-type="${next}"]`)?.focus();
  };

  const comboColours = { iconClass: style.ink, selectedClass: style.pickerActive, checkClass: style.ink };

  let fields: ReactNode;
  if (type === "client") {
    fields = (
      <>
        <ComboField
          label="Client"
          icon="apartment"
          placeholder="Choose a client"
          value={client.client}
          loadOptions={loadClients}
          onChange={(value) => {
            // A client project belongs to one client, so changing client clears it
            setClient((prev) => ({
              ...prev,
              client: value,
              project: value?.id === prev.client?.id ? prev.project : null,
            }));
          }}
          onCreate={createClient}
          createNoun="client"
          {...comboColours}
        />
        <ComboField
          label="Project"
          icon="work"
          placeholder="Choose a project"
          value={client.project}
          loadOptions={loadClientProjects}
          onChange={(value) => {
            setClient((prev) => ({ ...prev, project: value }));
          }}
          onCreate={(name) => createProject(name, "client", clientId)}
          createNoun="project"
          disabledReason={clientId ? undefined : "Choose a client first"}
          {...comboColours}
        />
        <Field label="Task title">
          <span className={fieldBox(false)}>
            <input
              value={client.title}
              placeholder="What are you working on?"
              onChange={(event) => {
                const title = event.currentTarget.value;
                setClient((prev) => ({ ...prev, title }));
              }}
              className={INPUT}
            />
          </span>
        </Field>
      </>
    );
  } else if (type === "internal") {
    fields = (
      <>
        <ComboField
          label="Project"
          icon="folder"
          placeholder="Choose a project"
          value={internal.project}
          loadOptions={loadInternalProjects}
          onChange={(value) => {
            setInternal((prev) => ({ ...prev, project: value }));
          }}
          onCreate={(name) => createProject(name, "internal", null)}
          createNoun="project"
          {...comboColours}
        />
        <Field label="Task title">
          <span className={fieldBox(false)}>
            <input
              value={internal.title}
              placeholder="What are you working on?"
              onChange={(event) => {
                const title = event.currentTarget.value;
                setInternal((prev) => ({ ...prev, title }));
              }}
              className={INPUT}
            />
          </span>
        </Field>
      </>
    );
  } else {
    fields = (
      <>
        <div className="flex flex-col gap-1.25">
          <Field label="Ticket number">
            <span className={fieldBox(ticketInvalid)}>
              <span className="font-mono text-body font-medium text-ink-muted">#</span>
              <input
                value={support.ticket}
                placeholder="4830"
                inputMode="numeric"
                aria-invalid={ticketInvalid}
                aria-describedby={ticketInvalid ? "start-ticket-error" : undefined}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setSupport((prev) => ({ ...prev, ticket: value }));
                }}
                className={`${INPUT} font-mono font-medium placeholder:font-sans placeholder:font-normal`}
              />
            </span>
          </Field>
          {ticketInvalid && <FieldError id="start-ticket-error">Ticket numbers are digits only</FieldError>}
        </div>
        <Field label="Subject">
          <span className={fieldBox(false)}>
            <input
              value={support.subject}
              placeholder="Short summary of the issue"
              onChange={(event) => {
                const subject = event.currentTarget.value;
                setSupport((prev) => ({ ...prev, subject }));
              }}
              className={INPUT}
            />
          </span>
        </Field>
        <ComboField
          label="Client"
          hint=" (optional)"
          icon="apartment"
          placeholder="None"
          noneLabel="None"
          value={support.client}
          loadOptions={loadClients}
          onChange={(value) => {
            setSupport((prev) => ({ ...prev, client: value }));
          }}
          onCreate={createClient}
          createNoun="client"
          {...comboColours}
        />
      </>
    );
  }

  const wide = variant === "wide";

  return (
    <div className="absolute inset-0 z-40">
      <div
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 animate-fade-in bg-ink/16 backdrop-blur-backdrop"
      />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label="Start a task"
        onKeyDown={onKeyDown}
        className={`absolute right-0 bottom-0 left-0 flex animate-sheet-in flex-col gap-3.5 overflow-y-auto rounded-t-sheet rounded-b-xl border border-white/95 bg-white/82 px-4 pt-2 pb-4 shadow-sheet backdrop-blur-sheet backdrop-saturate-150 [scrollbar-width:thin] ${
          wide ? "top-3" : "top-18"
        }`}
      >
        <div aria-hidden="true" className="h-1 w-9 shrink-0 self-center rounded-[2px] bg-ink-muted/30" />
        <div className="-mt-1 flex items-center justify-between">
          <span className="text-title tracking-title">Start a task</span>
          <button
            type="button"
            aria-label="Close"
            title="Close"
            onClick={onClose}
            className="grid size-8 place-items-center rounded-sm bg-ink-muted/8 text-ink-muted hover:bg-ink-muted/16 hover:text-ink"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        <div
          role="radiogroup"
          aria-label="Task type"
          className="grid shrink-0 grid-cols-3 rounded-tablist bg-ink-muted/8 p-0.75"
        >
          {SHEET_TYPES.map((key) => {
            const active = key === type;
            const keyStyle = TYPE_STYLES[key];
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={active}
                tabIndex={active ? 0 : -1}
                data-type={key}
                data-autofocus={active ? true : undefined}
                onClick={() => {
                  setType(key);
                }}
                onKeyDown={onTypeKeyDown}
                className={`flex h-9 items-center justify-center gap-1.25 rounded-sm text-caption font-semibold transition-[background-color] duration-200 focus-visible:outline-offset-1 ${
                  active ? `bg-white shadow-sm ${keyStyle.ink}` : "text-ink-muted hover:text-ink"
                }`}
              >
                <Icon name={keyStyle.icon} size={16} />
                {keyStyle.short}
              </button>
            );
          })}
        </div>

        <div className="flex shrink-0 flex-col gap-2.5">{fields}</div>

        <div className="flex shrink-0 flex-col gap-1.5">
          <span className="text-meta font-semibold text-ink-muted">
            Estimate <span className="font-normal">(optional)</span>
          </span>
          <div className="flex gap-1.5">
            {[...ESTIMATES.map((e) => e.label), "Custom" as const].map((label) => {
              const active = estimate === label;
              return (
                <button
                  key={label}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setEstimate(active ? null : label);
                  }}
                  className={`h-8 flex-1 rounded-sm border font-mono text-caption ${
                    active
                      ? "border-accent-ink bg-accent/16 font-semibold text-accent-ink-hover"
                      : "border-ink-muted/18 bg-white font-medium text-ink hover:bg-white/80"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {estimate === "Custom" && (
            <>
              <span className={fieldBox(estimateInvalid && customEstimate.trim() !== "")}>
                <Icon name="timer" size={16} className="text-ink-muted" />
                <input
                  // Choosing Custom is a request to type an estimate
                  autoFocus
                  value={customEstimate}
                  placeholder="45m or 1h 30m"
                  aria-label="Custom estimate"
                  aria-invalid={estimateInvalid}
                  onChange={(event) => {
                    setCustomEstimate(event.currentTarget.value);
                  }}
                  className={`${INPUT} font-mono font-medium placeholder:font-sans placeholder:font-normal`}
                />
              </span>
              {estimateInvalid && customEstimate.trim() !== "" && (
                <FieldError>Use minutes or hours, like 45m or 1h 30m</FieldError>
              )}
            </>
          )}
        </div>

        <button
          type="button"
          onClick={submit}
          aria-disabled={!ready}
          className={`flex h-13 shrink-0 items-center justify-center gap-2 rounded-lg text-cta text-white bg-accent-gradient-strong focus-visible:outline-offset-3 ${
            ready ? "shadow-cta-xl hover:-translate-y-px hover:shadow-cta-xl-hover" : "cursor-default opacity-45"
          }`}
        >
          <Icon name="play_arrow" size={22} fill />
          {START_LABEL[type]}
        </button>
        <div className="-mt-1.5 shrink-0 text-center text-duration text-ink-muted">
          {!draft ? (
            MISSING_HINT[type]
          ) : (
            <>
              {runningTaskId && "Pauses the running timer · "}
              <span className="font-mono">Ctrl Enter</span>
            </>
          )}
        </div>

        {recent.length > 0 && (
          <div className="flex min-h-0 flex-col gap-1">
            <span className="text-label tracking-[0.07em] text-ink-muted uppercase">Recent</span>
            {recent.map(({ task, lastStartedAt }) => {
              const taskStyle = TYPE_STYLES[task.type];
              const title = displayTitle(task);
              return (
                <div
                  key={task.id}
                  className="flex h-11 shrink-0 items-center gap-2 rounded-control pr-1 pl-2 hover:bg-white/80"
                >
                  <span
                    title={taskStyle.label}
                    className={`grid size-6.5 shrink-0 place-items-center rounded-[8px] ${taskStyle.tint} ${taskStyle.ink}`}
                  >
                    <Icon name={taskStyle.icon} size={15} />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col leading-[1.2]">
                    <span className="truncate text-ui-sm font-medium">{title}</span>
                    <span className="truncate text-duration text-ink-muted">
                      {displayMeta(task)} · {relativeDayLabel(workDayKey(new Date(lastStartedAt)), todayKey)}
                    </span>
                  </div>
                  <button
                    type="button"
                    aria-label={`Restart ${title}`}
                    title="Restart"
                    onClick={() => {
                      onReplay(task);
                      onClose();
                    }}
                    className="grid size-8 shrink-0 place-items-center rounded-full border-[1.5px] border-accent-ink/40 bg-white text-accent-ink hover:bg-accent/12"
                  >
                    <Icon name="replay" size={17} fill />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
