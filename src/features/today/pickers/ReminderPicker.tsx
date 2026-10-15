import { useEffect, useRef, useState } from "react";
import { FieldError } from "../../../components/FieldError";
import { nextOccurrence, parseTimeOfDay, QUICK_REMINDERS, reminderLength } from "../../../lib/reminder";
import { PICKER_PANEL, PickerOptions, usePickerList, type PickerOption } from "./Picker";

type ReminderPickerProps = {
  /** The current reminder (UTC ISO), if set. */
  value: string | null;
  /** The quick time highlighted first (4e "Default reminder"), in minutes. */
  defaultMinutes: number;
  selectedClass: string;
  checkClass: string;
  /** A new reminder time (UTC ISO), or null for none. */
  onChange: (remindAt: string | null) => void;
  onClose: () => void;
};

const NONE_ID = "none";
const quickId = (minutes: number): string => `in-${minutes}`;

/**
 * Reminder dropdown for the 2d Reminder field (the list itself is drafted): quick times,
 * a typed time of day (the next time it comes round), and None.
 */
export function ReminderPicker({
  value,
  defaultMinutes,
  selectedClass,
  checkClass,
  onChange,
  onClose,
}: ReminderPickerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [typed, setTyped] = useState("");
  const [typedError, setTypedError] = useState(false);

  const options: PickerOption[] = [
    ...QUICK_REMINDERS.map((minutes) => ({ id: quickId(minutes), label: `In ${reminderLength(minutes)}` })),
    ...(value ? [{ id: NONE_ID, label: "None" }] : []),
  ];

  const list = usePickerList({
    options,
    query: "",
    selectedId: null,
    initialActiveId: quickId(defaultMinutes),
    onSelect: (id) => {
      if (id === NONE_ID) {
        onChange(null);
        return;
      }
      const minutes = QUICK_REMINDERS.find((m) => quickId(m) === id);
      if (minutes !== undefined) onChange(new Date(Date.now() + minutes * 60_000).toISOString());
    },
    onClose,
  });

  useEffect(() => {
    listRef.current?.focus();
  }, []);

  useEffect(() => {
    // The parent wraps the field that opened the picker, so clicking the field again doesn't close-then-reopen
    const onPointerDown = (event: PointerEvent): void => {
      const area = panelRef.current?.parentElement ?? panelRef.current;
      if (area && !area.contains(event.target as Node)) onClose();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [onClose]);

  const submitTyped = (): void => {
    const time = parseTimeOfDay(typed);
    if (!time) {
      setTypedError(true);
      return;
    }
    onChange(nextOccurrence(time, new Date()).toISOString());
  };

  return (
    <div ref={panelRef} className={`absolute top-full left-0 mt-1 w-60 ${PICKER_PANEL}`}>
      <div
        ref={listRef}
        id={list.listId}
        role="listbox"
        aria-label="Reminder"
        tabIndex={0}
        onKeyDown={list.onKeyDown}
        aria-activedescendant={list.active ? list.optionId(list.active) : undefined}
        className="flex flex-col gap-0.5 focus-visible:outline-offset-1"
      >
        <PickerOptions
          list={list}
          selectedId={null}
          selectedClass={selectedClass}
          checkClass={checkClass}
          status="ready"
        />
      </div>
      <div aria-hidden="true" className="mx-1 my-0.5 h-px shrink-0 bg-ink-muted/12" />
      <input
        value={typed}
        placeholder="Type a time, e.g. 4:30 pm"
        aria-label="Reminder time"
        aria-invalid={typedError}
        onChange={(event) => {
          setTyped(event.currentTarget.value);
          setTypedError(false);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            submitTyped();
          } else if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            event.nativeEvent.stopImmediatePropagation();
            onClose();
          }
        }}
        className={`h-9 rounded-tile border bg-white px-2.5 font-mono text-ui font-medium text-ink placeholder:font-sans placeholder:font-normal placeholder:text-ink-placeholder focus-visible:outline-offset-1 ${
          typedError ? "border-[1.5px] border-status-error-edge" : "border-ink-muted/18"
        }`}
      />
      {typedError && (
        <div className="px-1 pt-0.5">
          <FieldError>Use a time like 4:30 pm</FieldError>
        </div>
      )}
    </div>
  );
}
