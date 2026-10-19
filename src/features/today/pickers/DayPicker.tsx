import { useState } from "react";
import { addDays, formatShortDate, fromLocalDayKey } from "../../../lib/date";
import { MonthPicker } from "../../calendar/DatePickers";
import { Picker, type PickerOption } from "./Picker";

type DayPickerProps = {
  /** The day the task is listed on. */
  value: string;
  /** Today's work day: earlier days can't be picked. */
  todayKey: string;
  selectedClass: string;
  checkClass: string;
  onChange: (day: string) => void;
  onClose: () => void;
};

const PICK_ID = "pick";

/** The next Monday after `key` (the "next working day" choice in 7f). */
function nextMonday(key: string): string {
  const weekday = fromLocalDayKey(key).getDay();
  return addDays(key, (8 - weekday) % 7 || 7);
}

/** The Day field's dropdown (7f): Today, Tomorrow, Monday, or Pick a date… (the 3b month picker). */
export function DayPicker({ value, todayKey, selectedClass, checkClass, onChange, onClose }: DayPickerProps) {
  const [monthOpen, setMonthOpen] = useState(false);
  const tomorrow = addDays(todayKey, 1);
  const monday = nextMonday(todayKey);
  const short = (key: string): string => formatShortDate(fromLocalDayKey(key));

  const options: PickerOption[] = [
    { id: todayKey, label: `Today · ${short(todayKey)}` },
    { id: tomorrow, label: `Tomorrow · ${short(tomorrow)}` },
    ...(monday !== tomorrow ? [{ id: monday, label: `Monday · ${short(monday)}` }] : []),
    { id: PICK_ID, label: "Pick a date…", icon: "calendar_today", iconClass: "text-accent-ink" },
  ];

  if (monthOpen) {
    return (
      <MonthPicker
        selectedKey={value < todayKey ? todayKey : value}
        todayKey={todayKey}
        minKey={todayKey}
        position="top-full left-0 mt-1"
        onSelect={(key) => {
          onChange(key);
        }}
        onClose={onClose}
      />
    );
  }

  return (
    <Picker
      label="Day"
      options={options}
      selectedId={options.some((option) => option.id === value) ? value : null}
      selectedClass={selectedClass}
      checkClass={checkClass}
      onSelect={(id) => {
        if (id === PICK_ID) setMonthOpen(true);
        else onChange(id);
      }}
      onClose={onClose}
    />
  );
}
