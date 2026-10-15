import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Icon, type IconName } from "../../../components/Icon";

export type PickerOption = {
  id: string;
  label: string;
  icon?: IconName;
  iconClass?: string;
};

export type PickerStatus = "loading" | "ready" | "error";

const CREATE_ID = "__create__";

/** Bold the part of the label that matches the filter, as in 2b ("**SLE** Hub"). */
function highlight(label: string, query: string): ReactNode {
  const index = query ? label.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (index < 0) return label;
  return (
    <>
      {label.slice(0, index)}
      <b className="font-bold">{label.slice(index, index + query.length)}</b>
      {label.slice(index + query.length)}
    </>
  );
}

type PickerListOptions = {
  options: readonly PickerOption[];
  query: string;
  selectedId: string | null;
  /** The option highlighted when the list opens, if not the selected one. */
  initialActiveId?: string;
  onSelect: (id: string) => void;
  onCreate?: (name: string) => void;
  onClose: () => void;
};

export type PickerList = {
  listId: string;
  trimmed: string;
  visible: PickerOption[];
  canCreate: boolean;
  active: string | null;
  setActiveId: (id: string) => void;
  choose: (id: string) => void;
  /** Arrow keys, Enter and Escape, for whichever element has focus. */
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  optionId: (id: string) => string;
};

/** Filtering, the active option and keyboard handling, shared by Picker and the sheet's combo fields. */
export function usePickerList({
  options,
  query,
  selectedId,
  initialActiveId,
  onSelect,
  onCreate,
  onClose,
}: PickerListOptions): PickerList {
  const listId = useId();
  const trimmed = query.trim();
  const visible = useMemo(
    () => options.filter((option) => option.label.toLowerCase().includes(trimmed.toLowerCase())),
    [options, trimmed],
  );
  const canCreate =
    Boolean(onCreate) && trimmed !== "" && !options.some((o) => o.label.toLowerCase() === trimmed.toLowerCase());
  const ids = [...visible.map((o) => o.id), ...(canCreate ? [CREATE_ID] : [])];

  const [activeId, setActiveId] = useState<string | null>(initialActiveId ?? selectedId);
  const active = activeId !== null && ids.includes(activeId) ? activeId : (ids[0] ?? null);

  const choose = (id: string): void => {
    if (id === CREATE_ID) onCreate?.(trimmed);
    else onSelect(id);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      event.nativeEvent.stopImmediatePropagation();
      onClose();
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (ids.length === 0) return;
      const index = active ? ids.indexOf(active) : -1;
      const next = event.key === "ArrowDown" ? (index + 1) % ids.length : (index - 1 + ids.length) % ids.length;
      setActiveId(ids[next]);
    } else if (event.key === "Enter" && !event.ctrlKey) {
      event.preventDefault();
      if (active) choose(active);
    }
  };

  return {
    listId,
    trimmed,
    visible,
    canCreate,
    active,
    setActiveId,
    choose,
    onKeyDown,
    optionId: (id: string) => `${listId}-${id}`,
  };
}

type PickerOptionsProps = {
  list: PickerList;
  selectedId: string | null;
  /** Selected row background, in the task type's colour (2b). */
  selectedClass: string;
  /** Check mark colour, the task type's ink (2b). */
  checkClass: string;
  createNoun?: string;
  status: PickerStatus;
};

/** The options, the current one checked, and "Create …" (2b). Goes inside a role="listbox" element. */
export function PickerOptions({ list, selectedId, selectedClass, checkClass, createNoun, status }: PickerOptionsProps) {
  const { visible, trimmed, canCreate, active, setActiveId, choose, optionId } = list;

  if (status === "loading") return <div className="px-2.5 py-2 text-meta text-ink-muted">Loading…</div>;
  if (status === "error") return <div className="px-2.5 py-2 text-meta text-status-error">Couldn’t load the list.</div>;

  return (
    <>
      {visible.map((option) => {
        const selected = option.id === selectedId;
        return (
          <div
            key={option.id}
            id={optionId(option.id)}
            role="option"
            aria-selected={selected}
            onPointerDown={(event) => {
              event.preventDefault();
            }}
            onClick={() => {
              choose(option.id);
            }}
            onPointerEnter={() => {
              setActiveId(option.id);
            }}
            className={`flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-tile px-2.5 text-ui ${
              selected ? `${selectedClass} font-medium` : active === option.id ? "bg-ink-muted/8" : ""
            }`}
          >
            {option.icon && <Icon name={option.icon} size={16} className={option.iconClass} />}
            <span className="min-w-0 flex-1 truncate">{highlight(option.label, trimmed)}</span>
            {selected && <Icon name="check" size={16} className={checkClass} />}
          </div>
        );
      })}
      {canCreate && (
        <>
          {visible.length > 0 && <div aria-hidden="true" className="mx-1 my-0.5 h-px shrink-0 bg-ink-muted/12" />}
          <div
            id={optionId(CREATE_ID)}
            role="option"
            aria-selected={false}
            onPointerDown={(event) => {
              event.preventDefault();
            }}
            onClick={() => {
              choose(CREATE_ID);
            }}
            onPointerEnter={() => {
              setActiveId(CREATE_ID);
            }}
            className={`flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-tile px-2.5 text-ui font-medium text-accent-ink ${
              active === CREATE_ID ? "bg-ink-muted/8" : ""
            }`}
          >
            <Icon name="add" size={16} />
            <span className="truncate">
              Create {createNoun} “{trimmed}”
            </span>
          </div>
        </>
      )}
    </>
  );
}

/** Panel style shared by Picker and the sheet's combo fields (2b). */
export const PICKER_PANEL = "z-20 flex flex-col gap-0.5 rounded-md border border-white bg-white/97 p-1.5 shadow-picker";

type PickerProps = {
  label: string;
  options: readonly PickerOption[];
  selectedId: string | null;
  selectedClass: string;
  checkClass: string;
  onSelect: (id: string) => void;
  onClose: () => void;
  /** Shows a filter field and, with `onCreate`, a "Create …" row (2b). */
  filterable?: boolean;
  filterPlaceholder?: string;
  createNoun?: string;
  onCreate?: (name: string) => void;
  status?: PickerStatus;
  /** Which edge of the opener the list lines up with. */
  align?: "left" | "right";
  initialActiveId?: string;
};

/** Dropdown list from the 2b project picker: filter, options with a check on the current one, and "Create …". */
export function Picker({
  label,
  options,
  selectedId,
  selectedClass,
  checkClass,
  onSelect,
  onClose,
  filterable = false,
  filterPlaceholder,
  createNoun,
  onCreate,
  status = "ready",
  align = "left",
  initialActiveId,
}: PickerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const list = usePickerList({ options, query, selectedId, initialActiveId, onSelect, onCreate, onClose });

  useEffect(() => {
    if (filterable) inputRef.current?.focus();
    else listRef.current?.focus();
  }, [filterable]);

  useEffect(() => {
    // The parent wraps the chip that opened the picker, so clicking the chip again doesn't close-then-reopen
    const onPointerDown = (event: PointerEvent): void => {
      const area = panelRef.current?.parentElement ?? panelRef.current;
      if (area && !area.contains(event.target as Node)) onClose();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [onClose]);

  return (
    <div
      ref={panelRef}
      className={`absolute top-full mt-1 w-60 ${align === "right" ? "right-0" : "left-0"} ${PICKER_PANEL}`}
    >
      {filterable && (
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => {
            setQuery(event.currentTarget.value);
          }}
          onKeyDown={list.onKeyDown}
          placeholder={filterPlaceholder}
          aria-label={label}
          role="combobox"
          aria-expanded="true"
          aria-controls={list.listId}
          aria-activedescendant={list.active ? list.optionId(list.active) : undefined}
          className="mb-1 h-9 rounded-tile border border-ink-muted/18 bg-white px-2.5 text-ui font-normal text-ink placeholder:text-ink-placeholder focus-visible:outline-offset-1"
        />
      )}
      <div
        ref={listRef}
        id={list.listId}
        role="listbox"
        aria-label={label}
        tabIndex={filterable ? -1 : 0}
        onKeyDown={filterable ? undefined : list.onKeyDown}
        aria-activedescendant={!filterable && list.active ? list.optionId(list.active) : undefined}
        className="flex max-h-56 flex-col gap-0.5 overflow-y-auto focus-visible:outline-offset-1"
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
    </div>
  );
}
