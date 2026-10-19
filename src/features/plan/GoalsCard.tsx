import { useState, type KeyboardEvent } from "react";
import { Icon } from "../../components/Icon";
import { MAX_GOALS, type Goal } from "../../data/plans";
import type { DayPlan } from "../../hooks/useDayPlan";

type GoalsCardProps = {
  plan: DayPlan;
  /** The Log (7e): goals and note shown, not edited. */
  readOnly?: boolean;
  className?: string;
};

/** Goals (up to 3, tickable) and a note for the day (7a; read-only in the Log, 7e). */
export function GoalsCard({ plan, readOnly = false, className = "" }: GoalsCardProps) {
  const done = plan.goals.filter((goal) => goal.doneAt).length;
  const count = readOnly ? `${done} of ${plan.goals.length} done` : `${done} of ${plan.goals.length}`;

  return (
    <section
      aria-label="Goals and note"
      className={`relative z-1 flex shrink-0 flex-col rounded-lg border border-white/85 bg-white/55 px-3 py-2.5 backdrop-blur-glass ${className}`}
    >
      <div className="mb-0.5 flex items-center gap-1.5">
        <Icon name="flag" size={15} fill className="text-accent-ink" />
        <h2 className="m-0 flex-1 text-label text-ink-muted uppercase">Goals</h2>
        {plan.goals.length > 0 && <span className="font-mono text-meta text-ink-muted">{count}</span>}
      </div>
      {plan.goals.map((goal) => (
        <GoalRow key={goal.id} goal={goal} plan={plan} readOnly={readOnly} />
      ))}
      {!readOnly && plan.goals.length < MAX_GOALS && <AddGoal onAdd={plan.addGoal} />}
      <NoteRow note={plan.note} readOnly={readOnly} onSave={plan.setNote} />
    </section>
  );
}

function Check({ done }: { done: boolean }) {
  return done ? (
    <span className="grid size-4.5 place-items-center rounded-full text-white bg-accent-gradient">
      <Icon name="check" size={13} />
    </span>
  ) : (
    <span className="size-4.5 rounded-full border-[1.5px] border-ink-muted/45" />
  );
}

function GoalRow({ goal, plan, readOnly }: { goal: Goal; plan: DayPlan; readOnly: boolean }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(goal.text);
  const done = Boolean(goal.doneAt);
  const textClass = `text-ui ${done ? "text-ink-muted line-through" : "text-ink"}`;

  if (readOnly) {
    return (
      <div className="flex min-h-8 items-center gap-2">
        <Check done={done} />
        <span className={textClass}>{goal.text}</span>
      </div>
    );
  }

  const save = (): void => {
    setEditing(false);
    plan.renameGoal(goal.id, text);
  };

  return (
    <div className="flex min-h-8 items-center gap-0.5">
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={`Goal done: ${goal.text}`}
        onClick={() => {
          plan.toggleGoal(goal.id);
        }}
        className="-ml-1.5 grid size-8 shrink-0 place-items-center rounded-full hover:bg-white/70"
      >
        <Check done={done} />
      </button>
      {editing ? (
        <input
          // Focus when it opens for editing
          ref={(element) => {
            element?.focus();
          }}
          value={text}
          aria-label="Goal"
          onChange={(event) => {
            setText(event.currentTarget.value);
          }}
          onBlur={save}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") {
              setText(goal.text);
              setEditing(false);
            }
          }}
          className="h-8 min-w-0 flex-1 rounded-tile border border-ink-muted/18 bg-white px-2 text-ui text-ink focus-visible:outline-offset-1"
        />
      ) : (
        <button
          type="button"
          title="Edit goal"
          onClick={() => {
            setText(goal.text);
            setEditing(true);
          }}
          className={`min-h-8 min-w-0 flex-1 rounded-tile px-1 text-left hover:bg-white/60 ${textClass}`}
        >
          {goal.text}
        </button>
      )}
    </div>
  );
}

function AddGoal({ onAdd }: { onAdd: (text: string) => void }) {
  const [text, setText] = useState("");
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    onAdd(text);
    setText("");
  };
  return (
    <label className="flex min-h-8 items-center gap-2 rounded-tile focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-accent">
      <Icon name="add" size={18} className="text-accent-ink" />
      <input
        value={text}
        aria-label="Add a goal"
        placeholder="Add a goal, press Enter"
        onChange={(event) => {
          setText(event.currentTarget.value);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => {
          if (text.trim()) {
            onAdd(text);
            setText("");
          }
        }}
        className="h-8 min-w-0 flex-1 bg-transparent text-ui text-ink placeholder:text-ink-placeholder focus-visible:outline-none"
      />
    </label>
  );
}

function NoteRow({ note, readOnly, onSave }: { note: string; readOnly: boolean; onSave: (note: string) => void }) {
  const [text, setText] = useState(note);
  const [lastNote, setLastNote] = useState(note);
  // Follow a note loaded or changed elsewhere (another day, a reload)
  if (note !== lastNote) {
    setLastNote(note);
    setText(note);
  }

  if (readOnly && note.trim() === "") return null;

  return (
    <div className="mt-1.5 flex items-start gap-1.5 border-t border-ink-muted/12 pt-2">
      <Icon name="edit_note" size={16} className="mt-1.5 text-ink-muted" />
      {readOnly ? (
        <p className="m-0 py-1 text-ui-sm leading-[1.45] whitespace-pre-wrap text-ink-muted">{note}</p>
      ) : (
        <textarea
          value={text}
          rows={2}
          aria-label="Note for the day"
          placeholder="Add a note for the day"
          onChange={(event) => {
            setText(event.currentTarget.value);
          }}
          onBlur={() => {
            if (text !== note) onSave(text);
          }}
          className="min-h-12 flex-1 resize-none rounded-tile bg-transparent px-1 py-1 text-ui-sm leading-[1.45] text-ink-muted placeholder:text-ink-placeholder hover:bg-white/50 focus:bg-white focus:text-ink focus-visible:outline-offset-1"
        />
      )}
    </div>
  );
}
