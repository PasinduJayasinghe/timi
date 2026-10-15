import { useEffect, useState } from "react";
import { Icon, type IconName } from "../../components/Icon";
import {
  PICKER_PANEL,
  PickerOptions,
  usePickerList,
  type PickerOption,
  type PickerStatus,
} from "../today/pickers/Picker";

/** A chosen client or project. */
export type CatalogRef = { id: string; name: string };

type ComboFieldProps = {
  label: string;
  /** e.g. " (optional)". */
  hint?: string;
  icon: IconName;
  /** Icon colour, the task type's ink (2a). */
  iconClass: string;
  placeholder: string;
  value: CatalogRef | null;
  /** Loads the list when it opens. */
  loadOptions: () => Promise<PickerOption[]>;
  /** An extra first option, e.g. "None" for an optional client (2c). */
  noneLabel?: string;
  onChange: (value: CatalogRef | null) => void;
  /** Creates a new client or project from the typed name. */
  onCreate: (name: string) => Promise<CatalogRef>;
  createNoun: string;
  /** Picker row highlight and check colour, in the task type's colour (2b). */
  selectedClass: string;
  checkClass: string;
  /** Set when the field can't be used yet, e.g. "Choose a client first". */
  disabledReason?: string;
};

const NONE_ID = "__none__";

/** Sheet field with a filterable list (2a fields, 2b open state): typing filters, Enter picks. */
export function ComboField({
  label,
  hint = "",
  icon,
  iconClass,
  placeholder,
  value,
  loadOptions,
  noneLabel,
  onChange,
  onCreate,
  createNoun,
  selectedClass,
  checkClass,
  disabledReason,
}: ComboFieldProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<PickerOption[]>([]);
  // Stays "ready" while a reopened list refreshes
  const [status, setStatus] = useState<PickerStatus>("loading");
  const disabled = disabledReason !== undefined;

  const allOptions: PickerOption[] = [...(noneLabel ? [{ id: NONE_ID, label: noneLabel }] : []), ...options];
  const selectedId = value?.id ?? (noneLabel ? NONE_ID : null);

  const close = (): void => {
    setOpen(false);
    setQuery("");
  };

  const list = usePickerList({
    options: allOptions,
    query,
    selectedId,
    onSelect: (id) => {
      close();
      if (id === NONE_ID) onChange(null);
      else onChange({ id, name: allOptions.find((o) => o.id === id)?.label ?? "" });
    },
    onCreate: (name) => {
      close();
      onCreate(name)
        .then(onChange)
        .catch((error: unknown) => {
          console.error("[catalog] create failed", error);
        });
    },
    onClose: close,
  });

  // Load the list each time it opens, so new clients and projects appear
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    loadOptions()
      .then((loaded) => {
        if (cancelled) return;
        setOptions(loaded);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        console.error("[catalog] load failed", error);
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [open, loadOptions]);

  const openList = (): void => {
    if (!disabled) setOpen(true);
  };

  return (
    <div className="relative">
      <label className={`flex flex-col gap-1.25 ${disabled ? "opacity-50" : ""}`} title={disabledReason}>
        <span className="text-meta font-semibold text-ink-muted">
          {label}
          <span className="font-normal">{hint}</span>
        </span>
        <span
          className={`flex h-10 items-center gap-2 rounded-control px-3 ${
            open
              ? "border border-white bg-white outline-2 outline-offset-1 outline-accent"
              : "border border-ink-muted/18 bg-white/85 focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-accent"
          }`}
        >
          <Icon name={icon} size={17} className={iconClass} />
          <input
            value={open ? query : (value?.name ?? "")}
            placeholder={open ? (value?.name ?? placeholder) : placeholder}
            disabled={disabled}
            role="combobox"
            aria-expanded={open}
            aria-controls={list.listId}
            aria-autocomplete="list"
            aria-activedescendant={open && list.active ? list.optionId(list.active) : undefined}
            onClick={openList}
            onChange={(event) => {
              setQuery(event.currentTarget.value);
              openList();
            }}
            onKeyDown={(event) => {
              if (!open) {
                if (event.key === "ArrowDown" || (event.key === "Enter" && !event.ctrlKey)) {
                  event.preventDefault();
                  openList();
                }
                return;
              }
              list.onKeyDown(event);
            }}
            onBlur={close}
            className="min-w-0 flex-1 bg-transparent text-body font-normal text-ink placeholder:text-ink-placeholder focus-visible:outline-none disabled:cursor-default"
          />
          <Icon name={open ? "expand_less" : "expand_more"} size={18} className="text-ink-muted" />
        </span>
      </label>
      {open && (
        <div
          id={list.listId}
          role="listbox"
          aria-label={label}
          className={`absolute top-full right-0 left-0 mt-1 max-h-56 overflow-y-auto ${PICKER_PANEL}`}
        >
          <PickerOptions
            list={list}
            selectedId={selectedId}
            selectedClass={selectedClass}
            checkClass={checkClass}
            createNoun={createNoun}
            status={status}
          />
        </div>
      )}
    </div>
  );
}
