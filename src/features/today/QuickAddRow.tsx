import { useState } from "react";
import { Icon } from "../../components/Icon";

type QuickAddRowProps = {
  /** "expanded" is 1a/1b; "wide" is the denser 1d row. */
  variant?: "expanded" | "wide";
  autoFocus?: boolean;
  /** Called with the trimmed title when Enter is pressed. */
  onAdd: (title: string) => void;
};

const ROW_CLASS = {
  expanded: "h-10 rounded-md bg-white/62 border-white/90 shadow-input backdrop-blur-control",
  wide: "h-9.5 rounded-tablist bg-white/70 border-white",
} as const;

const INPUT_TEXT = {
  expanded: "text-body",
  wide: "text-ui",
} as const;

const BUTTON_CLASS = {
  expanded: "h-10 rounded-md text-ui shadow-cta hover:shadow-cta-hover",
  wide: "h-9.5 rounded-tablist text-ui",
} as const;

/** Quick add field and Start task button. Enter adds a task; Start task arrives with Phase 2. */
export function QuickAddRow({ variant = "expanded", autoFocus = false, onAdd }: QuickAddRowProps) {
  const [draft, setDraft] = useState("");

  return (
    <div className="flex gap-2">
      <label
        className={`flex min-w-0 flex-1 items-center gap-2 border px-3 focus-within:border-white focus-within:bg-white/85 focus-within:shadow-focus-halo focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent ${ROW_CLASS[variant]}`}
      >
        <Icon name="add" size={18} className="text-accent-ink" />
        <input
          value={draft}
          onChange={(event) => {
            setDraft(event.currentTarget.value);
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            const title = draft.trim();
            if (title === "") return;
            onAdd(title);
            setDraft("");
          }}
          autoFocus={autoFocus}
          placeholder="Add a task, press Enter"
          aria-label="Quick add task"
          className={`min-w-0 flex-1 border-none bg-transparent font-normal text-ink outline-none placeholder:text-ink-placeholder focus-visible:outline-none ${INPUT_TEXT[variant]}`}
        />
      </label>
      <button
        type="button"
        aria-disabled="true"
        className={`flex items-center gap-1.5 pr-3.5 pl-2.5 font-semibold text-white bg-accent-gradient-strong hover:-translate-y-px ${BUTTON_CLASS[variant]}`}
      >
        <Icon name="play_arrow" size={20} fill />
        Start task
      </button>
    </div>
  );
}
