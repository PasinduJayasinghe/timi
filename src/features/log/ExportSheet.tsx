import { useEffect, useState } from "react";
import { Icon } from "../../components/Icon";
import { useToast } from "../../components/Toast";
import { writesSettled } from "../../data/db";
import { exportXlsx, openExport } from "../../data/export";
import * as sessionStore from "../../data/sessions";
import * as taskStore from "../../data/tasks";
import { weekStartKey } from "../../lib/calendar";
import { addDays, formatShortDate, fromLocalDayKey } from "../../lib/date";
import { formatDuration } from "../../lib/duration";
import { buildExport, exportFileName, type ExportData } from "../../lib/exportRows";
import { plural } from "../../lib/text";
import { MonthPicker } from "../calendar/DatePickers";
import { SheetActions, ShiftSheet } from "../shift/ShiftSheet";

type Range = "today" | "week" | "last-week" | "custom";

type ExportSheetProps = {
  variant: "expanded" | "wide";
  /** The day shown in the Log: the starting range. */
  dayKey: string;
  todayKey: string;
  onClose: () => void;
};

const RANGES: ReadonlyArray<{ id: Range; label: string }> = [
  { id: "today", label: "Today" },
  { id: "week", label: "This week" },
  { id: "last-week", label: "Last week" },
  { id: "custom", label: "Custom" },
];

/** Export to Excel (9b): pick a range, see what's in it, then Save As. */
export function ExportSheet({ variant, dayKey, todayKey, onClose }: ExportSheetProps) {
  const toast = useToast();
  const [range, setRange] = useState<Range>(dayKey === todayKey ? "today" : "custom");
  const [custom, setCustom] = useState({ from: dayKey, to: dayKey });
  const [picker, setPicker] = useState<"from" | "to" | null>(null);
  const [data, setData] = useState<ExportData | "loading" | "error">("loading");
  const [saving, setSaving] = useState(false);

  const week = weekStartKey(todayKey);
  let from = custom.from;
  let to = custom.to;
  if (range === "today") from = to = todayKey;
  else if (range === "week") [from, to] = [week, addDays(week, 6)];
  else if (range === "last-week") [from, to] = [addDays(week, -7), addDays(week, -1)];

  useEffect(() => {
    let cancelled = false;
    setData("loading");
    const load = async (): Promise<void> => {
      await writesSettled();
      const [tasks, sessions] = await Promise.all([
        taskStore.listForDayRange(from, addDays(to, 1)),
        sessionStore.listForDays(from, addDays(to, 1)),
      ]);
      if (!cancelled) setData(buildExport(tasks, sessions, Date.now()));
    };
    load().catch((error: unknown) => {
      console.error("[export] load failed", error);
      if (!cancelled) setData("error");
    });
    return () => {
      cancelled = true;
    };
  }, [from, to]);

  const ready = typeof data === "object";
  const empty = ready && data.sessions.length === 0 && data.tasks.length === 0;

  const run = (): void => {
    if (!ready || empty || saving) return;
    const fileName = exportFileName(from, to);
    setSaving(true);
    exportXlsx(fileName, data.tasks, data.sessions)
      .then((path) => {
        setSaving(false);
        if (path === null) return;
        onClose();
        const name = path.split(/[\\/]/).pop() ?? fileName;
        toast({
          tone: "success",
          message: `Exported “${name}”`,
          action: {
            label: "Open file",
            onClick: () => {
              openExport(path).catch((error: unknown) => {
                console.error("[export] open failed", error);
              });
            },
          },
        });
      })
      .catch((error: unknown) => {
        console.error("[export] save failed", error);
        setSaving(false);
        toast({
          tone: "error",
          message: "Couldn’t save the file. If it’s open in Excel, close it and try again.",
          action: { label: "Try again", onClick: run },
        });
      });
  };

  const dateField = (which: "from" | "to") => {
    const value = which === "from" ? from : to;
    const editable = range === "custom";
    return (
      <div className="relative flex flex-col gap-1.25">
        <span className="text-meta font-semibold text-ink-muted">{which === "from" ? "From" : "To"}</span>
        <button
          type="button"
          disabled={!editable}
          aria-haspopup="dialog"
          aria-expanded={picker === which}
          onClick={() => {
            setPicker(picker === which ? null : which);
          }}
          className={`flex h-9.5 items-center gap-1.5 rounded-cta-sm px-2.5 text-left text-ui font-medium ${
            editable ? "border border-ink-muted/18 bg-white hover:bg-white/80" : "bg-ink-muted/6 text-ink-muted"
          }`}
        >
          <Icon name="calendar_today" size={16} className="text-ink-muted" />
          {formatShortDate(fromLocalDayKey(value))}
        </button>
        {picker === which && (
          <MonthPicker
            selectedKey={value}
            todayKey={todayKey}
            minKey={which === "to" ? custom.from : undefined}
            position={which === "from" ? "top-full left-0 mt-1" : "top-full right-0 mt-1"}
            onSelect={(key) => {
              setCustom((current) =>
                which === "from" ? { from: key, to: key > current.to ? key : current.to } : { ...current, to: key },
              );
              setPicker(null);
            }}
            onClose={() => {
              setPicker(null);
            }}
          />
        )}
      </div>
    );
  };

  let summary;
  if (data === "loading") summary = <span className="h-12 rounded-control bg-white/50" />;
  else if (data === "error")
    summary = <span className="text-caption text-status-error">Couldn’t read that range. Try another.</span>;
  else {
    const stats = [
      { label: "days", value: String(data.days) },
      { label: "tasks", value: String(data.tasks.length) },
      { label: "sessions", value: String(data.sessions.length) },
      { label: "tracked", value: formatDuration(data.trackedSeconds) },
    ];
    summary = (
      <div className="grid grid-cols-4 gap-1.5">
        {stats.map((stat) => (
          <div key={stat.label} className="flex flex-col gap-px">
            <span className={`font-mono text-[15px] font-semibold ${empty ? "text-ink-disabled" : ""}`}>
              {stat.value}
            </span>
            <span className="text-duration text-ink-muted">{stat.label}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <ShiftSheet
      title="Export to Excel"
      icon="table_view"
      iconClass="text-accent-ink"
      variant={variant}
      onClose={onClose}
    >
      <div role="radiogroup" aria-label="Range" className="flex shrink-0 gap-1">
        {RANGES.map((option) => {
          const active = option.id === range;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={active}
              data-autofocus={active ? true : undefined}
              onClick={() => {
                setRange(option.id);
                if (option.id === "custom") setCustom({ from, to });
              }}
              className={`h-8 rounded-sm border px-2.5 text-caption whitespace-nowrap ${
                active
                  ? "border-accent-ink bg-accent/16 font-semibold text-accent-ink-hover"
                  : "border-ink-muted/18 bg-white font-medium hover:bg-white/70"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <div className="grid shrink-0 grid-cols-2 gap-2.5">
        {dateField("from")}
        {dateField("to")}
      </div>
      <div className="flex shrink-0 flex-col gap-2.5 rounded-md border border-white bg-white/65 p-3">
        {summary}
        <span className="flex items-start gap-1.5 text-meta leading-[1.45] text-ink-muted">
          <Icon name="info" size={15} />
          {empty
            ? "Nothing was tracked or planned in this range. Pick other dates."
            : `Two sheets: Tasks and Sessions${ready ? ` (${plural(data.tasks.length, "row")} and ${plural(data.sessions.length, "row")})` : ""}. Days follow your shifts, like the Log. A running session counts up to now.`}
        </span>
      </div>
      <SheetActions
        primary={saving ? "Saving…" : "Export…"}
        primaryIcon="download"
        onPrimary={run}
        secondary="Cancel"
        onSecondary={onClose}
        disabled={empty || !ready || saving}
      />
    </ShiftSheet>
  );
}
