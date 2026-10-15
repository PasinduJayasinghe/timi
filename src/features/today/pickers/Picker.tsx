import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Icon } from "../../../components/Icon";

export type PickerOption = {
  id: string;
  label: string;
  icon?: string;
  iconClass?: string;
};

type PickerProps = {
  label: string;
  options: readonly PickerOption[];
  selectedId: string | null;
  /** Selected row background, in the task type's colour (2b). */
  selectedClass: string;
  /** Check mark colour, the task type's ink (2b). */
  checkClass: string;
  onSelect: (id: string) => void;
  onClose: () => void;
  /** Shows a filter field and, with `onCreate`, a "Create …" row (2b). */
  filterable?: boolean;
  filterPlaceholder?: string;
  createNoun?: string;
  onCreate?: (name: string) => void;
  status?: "loading" | "ready" | "error";
};

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
}: PickerProps) {
  const listId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");

  const trimmed = query.trim();
  const visible = useMemo(
    () => options.filter((option) => option.label.toLowerCase().includes(trimmed.toLowerCase())),
    [options, trimmed],
  );
  const canCreate =
    Boolean(onCreate) && trimmed !== "" && !options.some((o) => o.label.toLowerCase() === trimmed.toLowerCase());
  const ids = [...visible.map((o) => o.id), ...(canCreate ? [CREATE_ID] : [])];

  const [activeId, setActiveId] = useState<string | null>(selectedId);
  const active = activeId !== null && ids.includes(activeId) ? activeId : (ids[0] ?? null);

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

  const choose = (id: string): void => {
    if (id === CREATE_ID) onCreate?.(trimmed);
    else onSelect(id);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (ids.length === 0) return;
      const index = active ? ids.indexOf(active) : -1;
      const next = event.key === "ArrowDown" ? (index + 1) % ids.length : (index - 1 + ids.length) % ids.length;
      setActiveId(ids[next]);
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (active) choose(active);
    }
  };

  const optionId = (id: string): string => `${listId}-${id}`;

  return (
    <div
      ref={panelRef}
      className="absolute top-full left-0 z-20 mt-1 flex w-60 flex-col gap-0.5 rounded-md border border-white bg-white/97 p-1.5 shadow-picker"
    >
      {filterable && (
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => {
            setQuery(event.currentTarget.value);
          }}
          onKeyDown={onKeyDown}
          placeholder={filterPlaceholder}
          aria-label={label}
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={active ? optionId(active) : undefined}
          className="mb-1 h-9 rounded-tile border border-ink-muted/18 bg-white px-2.5 text-ui font-normal text-ink placeholder:text-ink-placeholder focus-visible:outline-offset-1"
        />
      )}
      <div
        ref={listRef}
        id={listId}
        role="listbox"
        aria-label={label}
        tabIndex={filterable ? -1 : 0}
        onKeyDown={filterable ? undefined : onKeyDown}
        aria-activedescendant={!filterable && active ? optionId(active) : undefined}
        className="flex max-h-56 flex-col gap-0.5 overflow-y-auto focus-visible:outline-offset-1"
      >
        {status === "loading" && <div className="px-2.5 py-2 text-meta text-ink-muted">Loading…</div>}
        {status === "error" && <div className="px-2.5 py-2 text-meta text-status-error">Couldn’t load the list.</div>}
        {status === "ready" &&
          visible.map((option) => {
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
      </div>
    </div>
  );
}
