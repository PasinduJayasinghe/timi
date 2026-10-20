import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Icon, type IconName } from "../../components/Icon";
import { LoadError } from "../../components/LoadError";
import { useToast } from "../../components/Toast";
import { useDelayedFlag } from "../../hooks/useDelayedFlag";
import { useNotes, type Notes } from "../../hooks/useNotes";
import { useNow } from "../../hooks/useNow";
import { editedLabel, matchesSearch, notePreview, noteTitle, type Note } from "../../lib/notes";

type NotesViewProps = {
  /** "expanded" is 8a/8b (list, then the open note); "wide" is 8c (side by side). */
  variant: "expanded" | "wide";
  /** Adds the note's first line as a task for today (8b). */
  onMakeTask: (title: string) => void;
  /** Opens the Today tab (the Make a task toast's "Open"). */
  onOpenToday: () => void;
  onSaveError: () => void;
};

/** Typing saves after this pause (8b: no Save button). */
const SAVE_DELAY_MS = 600;

/** The Notes tab (Phase 10): short notes, pinned first, with search and quick add. */
export function NotesView({ variant, onMakeTask, onOpenToday, onSaveError }: NotesViewProps) {
  const notes = useNotes(onSaveError);
  const toast = useToast();
  const wide = variant === "wide";
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const now = useNow(true, 60_000);

  const showLoading = useDelayedFlag(notes.status === "loading");

  const visible = notes.notes.filter((note) => matchesSearch(note, query));
  // Wide mode always shows a note on the right: the one opened, or the first
  const open = notes.notes.find((note) => note.id === openId) ?? (wide ? visible[0] : undefined);

  const add = (text: string): void => {
    const note = notes.create(text);
    setQuery("");
    setOpenId(note.id);
  };

  const remove = (note: Note): void => {
    const removed = notes.remove(note.id);
    setOpenId(null);
    if (!removed) return;
    toast({
      message: "Note deleted",
      tone: "neutral",
      icon: "delete",
      action: {
        label: "Undo",
        onClick: () => {
          notes.restore(removed);
        },
      },
    });
  };

  const makeTask = (note: Note): void => {
    const title = noteTitle(note.body);
    onMakeTask(title);
    toast({
      message: `Added “${title}” to today`,
      tone: "accent",
      icon: "check_circle",
      action: { label: "Open", onClick: onOpenToday },
    });
  };

  const editor = open && (
    <NoteEditor
      key={open.id}
      note={open}
      variant={variant}
      now={now}
      notes={notes}
      onBack={() => {
        setOpenId(null);
      }}
      onMakeTask={() => {
        makeTask(open);
      }}
      onDelete={() => {
        remove(open);
      }}
    />
  );

  const list = (
    <NotesList
      notes={notes}
      visible={visible}
      query={query}
      wide={wide}
      now={now}
      showLoading={showLoading}
      selectedId={wide ? (open?.id ?? null) : null}
      onQuery={setQuery}
      onAdd={add}
      onOpen={setOpenId}
    />
  );

  if (wide) {
    return (
      <div className="relative z-1 grid min-h-0 flex-1 grid-cols-[290px_1fr] gap-2.5 px-2.5 pb-2.5">
        <section
          aria-label="Notes"
          className="relative flex min-h-0 flex-col gap-2 overflow-hidden rounded-panel border border-white/80 bg-white/40 p-2.5 backdrop-blur-glass"
        >
          {list}
        </section>
        {editor || (
          <section className="grid place-items-center rounded-panel border border-white/80 bg-white/40 text-ui text-ink-muted">
            {notes.status === "ready" && notes.notes.length > 0 ? "Pick a note on the left." : ""}
          </section>
        )}
      </div>
    );
  }

  return <div className="relative z-1 flex min-h-0 flex-1 flex-col px-3 pb-3">{editor || list}</div>;
}

type NotesListProps = {
  notes: Notes;
  visible: Note[];
  query: string;
  wide: boolean;
  now: number;
  showLoading: boolean;
  selectedId: string | null;
  onQuery: (query: string) => void;
  onAdd: (text: string) => void;
  onOpen: (id: string) => void;
};

function NotesList({
  notes,
  visible,
  query,
  wide,
  now,
  showLoading,
  selectedId,
  onQuery,
  onAdd,
  onOpen,
}: NotesListProps) {
  const [draft, setDraft] = useState("");
  const pinned = visible.filter((note) => note.pinned);
  const others = visible.filter((note) => !note.pinned);

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    onAdd(text);
    setDraft("");
  };

  let body: ReactNode;
  if (notes.status === "error") {
    body = <LoadError title="Couldn’t load your notes" subject="notes" onRetry={notes.reload} />;
  } else if (notes.status === "loading") {
    body = (
      <div aria-busy="true" aria-label="Loading notes" className="flex flex-col gap-1.5">
        {showLoading && [0, 1, 2].map((index) => <div key={index} className="h-16 rounded-lg bg-ink-muted/8" />)}
      </div>
    );
  } else if (notes.notes.length === 0) {
    body = (
      <div className="flex flex-col gap-2 rounded-lg border border-white/85 bg-white/55 px-4 py-3.5">
        <span className="text-heading">No notes yet.</span>
        <span className="text-ui leading-[1.55] text-ink-muted">
          Jot down anything above — a link, a code, a thought for later. Notes stay on this PC.
        </span>
      </div>
    );
  } else if (visible.length === 0) {
    body = (
      <div className="flex flex-col items-start gap-2 px-1 pt-1">
        <span className="text-ui text-ink-muted">No notes match “{query.trim()}”.</span>
        <button
          type="button"
          onClick={() => {
            onQuery("");
          }}
          className="h-8 rounded-sm bg-accent/12 px-2.5 text-ui-sm font-semibold text-accent-ink hover:bg-accent/20"
        >
          Clear search
        </button>
      </div>
    );
  } else {
    const card = (note: Note) => (
      <NoteCard
        key={note.id}
        note={note}
        query={query}
        now={now}
        selected={note.id === selectedId}
        onOpen={() => {
          onOpen(note.id);
        }}
      />
    );
    body = (
      <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pb-1 [scrollbar-width:thin]">
        {pinned.length > 0 && (
          <span className="pt-1 text-label text-ink-muted uppercase">Pinned · {pinned.length}</span>
        )}
        {pinned.map(card)}
        {pinned.length > 0 && others.length > 0 && (
          <span className="pt-2 text-label text-ink-muted uppercase">Notes</span>
        )}
        {others.map(card)}
      </div>
    );
  }

  const field = `flex shrink-0 items-center gap-2 border border-white/90 bg-white/62 px-3 shadow-input focus-within:bg-white/85 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent ${
    wide ? "h-9.5 rounded-tablist" : "h-10 rounded-md"
  }`;

  return (
    <div className={`flex min-h-0 flex-1 flex-col ${wide ? "gap-2" : "gap-2"}`}>
      <label className={field}>
        <Icon name="search" size={18} className="text-ink-muted" />
        <input
          value={query}
          aria-label="Search notes"
          placeholder="Search notes"
          onChange={(event) => {
            onQuery(event.currentTarget.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") onQuery("");
          }}
          className="min-w-0 flex-1 bg-transparent text-body text-ink placeholder:text-ink-placeholder focus-visible:outline-none"
        />
      </label>
      <label className={field}>
        <Icon name="add" size={18} className="text-accent-ink" />
        <input
          value={draft}
          aria-label="Write a note"
          placeholder="Write a note, press Enter"
          onChange={(event) => {
            setDraft(event.currentTarget.value);
          }}
          onKeyDown={onKeyDown}
          className="min-w-0 flex-1 bg-transparent text-body text-ink placeholder:text-ink-placeholder focus-visible:outline-none"
        />
      </label>
      <div className="mt-1 flex min-h-0 flex-1 flex-col">{body}</div>
    </div>
  );
}

/** Marks the search in a piece of text (8d). */
function Highlight({ text, query }: { text: string; query: string }) {
  const value = query.trim().toLowerCase();
  const index = value ? text.toLowerCase().indexOf(value) : -1;
  if (index < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, index)}
      <mark className="rounded-[3px] bg-type-meeting/30 px-px text-inherit">
        {text.slice(index, index + value.length)}
      </mark>
      {text.slice(index + value.length)}
    </>
  );
}

function NoteCard({
  note,
  query,
  now,
  selected,
  onOpen,
}: {
  note: Note;
  query: string;
  now: number;
  selected: boolean;
  onOpen: () => void;
}) {
  const preview = notePreview(note.body);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-current={selected ? "true" : undefined}
      className={`flex shrink-0 flex-col gap-0.75 rounded-lg px-3 py-2.5 text-left shadow-row hover:bg-white/80 ${
        selected ? "border-[1.5px] border-accent bg-white/80" : "border border-white/85 bg-white/55"
      }`}
    >
      <span className="flex w-full items-center gap-1.5">
        <span className="min-w-0 flex-1 truncate text-body font-semibold">
          <Highlight text={noteTitle(note.body)} query={query} />
        </span>
        {note.pinned && <Icon name="push_pin" size={14} fill className="text-accent-ink" />}
      </span>
      {preview && (
        <span className="line-clamp-2 text-ui-sm leading-[1.45] text-ink-muted">
          <Highlight text={preview} query={query} />
        </span>
      )}
      <span className="font-mono text-label font-normal tracking-normal text-ink-muted">
        {editedLabel(note.updatedAt, now)}
      </span>
    </button>
  );
}

function ActionButton({
  icon,
  label,
  text,
  onClick,
  active = false,
  danger = false,
}: {
  icon: IconName;
  label: string;
  text?: string;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
}) {
  let tone = "bg-white/60 text-ink-muted hover:bg-white hover:text-ink";
  if (active) tone = "bg-accent/16 text-accent-ink hover:bg-accent/24";
  if (danger) tone = "bg-white/60 text-status-error hover:bg-status-error-surface";
  return (
    <button
      type="button"
      aria-label={text ? undefined : label}
      title={label}
      aria-pressed={active || undefined}
      onClick={onClick}
      className={`flex h-8 shrink-0 items-center justify-center gap-1.25 rounded-sm ${text ? "px-2.5" : "w-8"} ${tone}`}
    >
      <Icon name={icon} size={18} fill={active} />
      {text && <span className="text-ui-sm font-semibold">{text}</span>}
    </button>
  );
}

type NoteEditorProps = {
  note: Note;
  variant: "expanded" | "wide";
  now: number;
  notes: Notes;
  onBack: () => void;
  onMakeTask: () => void;
  onDelete: () => void;
};

/** An open note (8b): edited in place and saved as you type. */
function NoteEditor({ note, variant, now, notes, onBack, onMakeTask, onDelete }: NoteEditorProps) {
  const wide = variant === "wide";
  const [text, setText] = useState(note.body);
  const textRef = useRef(text);
  textRef.current = text;
  const saveRef = useRef(notes.updateBody);
  saveRef.current = notes.updateBody;
  const saved = text === note.body;

  // Save after a short pause in typing
  useEffect(() => {
    if (text === note.body) return;
    const timeoutId = window.setTimeout(() => {
      saveRef.current(note.id, text);
    }, SAVE_DELAY_MS);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [text, note.body, note.id]);

  // And whatever is left when the note closes
  useEffect(() => {
    return () => {
      if (textRef.current.trim() !== "") saveRef.current(note.id, textRef.current);
    };
  }, [note.id]);

  const created = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" }).format(
    new Date(note.createdAt),
  );

  return (
    <section
      aria-label={noteTitle(text)}
      className="relative flex min-h-0 flex-1 flex-col rounded-panel border border-white bg-white/70 shadow-md backdrop-blur-glass"
    >
      <div className="flex shrink-0 items-center gap-1 px-2 pt-2 pb-1.5">
        {wide ? (
          <span className="flex-1 pl-2 font-mono text-meta text-ink-muted">{editedLabel(note.updatedAt, now)}</span>
        ) : (
          <>
            <button
              type="button"
              onClick={onBack}
              className="flex h-8 items-center gap-0.5 rounded-sm pr-2 pl-1 text-ui font-semibold text-ink-muted hover:bg-white/70 hover:text-ink"
            >
              <Icon name="chevron_left" size={18} />
              Notes
            </button>
            <span className="flex-1" />
          </>
        )}
        <ActionButton
          icon="push_pin"
          label={note.pinned ? "Unpin" : "Pin"}
          active={note.pinned}
          onClick={() => {
            notes.togglePin(note.id);
          }}
        />
        <ActionButton icon="add_task" label="Make a task" text="Make a task" onClick={onMakeTask} />
        <ActionButton icon="delete" label="Delete note" danger onClick={onDelete} />
      </div>
      <textarea
        value={text}
        aria-label="Note"
        autoFocus={!wide}
        onChange={(event) => {
          setText(event.currentTarget.value);
        }}
        onBlur={() => {
          if (!saved) notes.updateBody(note.id, text);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape" && !wide) {
            event.preventDefault();
            onBack();
          }
        }}
        className="mx-2 min-h-0 flex-1 resize-none rounded-control bg-transparent px-3 py-2 text-body leading-[1.6] text-ink first-line:text-[17px] first-line:font-bold focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent"
      />
      <div className="flex shrink-0 items-center gap-1.5 px-4 py-2.5 text-meta text-ink-muted">
        {saved ? (
          <>
            <Icon name="check_circle" size={14} fill className="text-status-success" />
            <span className="font-semibold text-status-success">Saved</span>
          </>
        ) : (
          <span>Saving…</span>
        )}
        <span>
          · {editedLabel(note.updatedAt, now)} · created {created}
        </span>
      </div>
    </section>
  );
}
