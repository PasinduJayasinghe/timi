import { Icon } from "./Icon";

/** The round-cornered Close button in sheet and dialog headers (2a). */
export function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Close"
      title="Close"
      onClick={onClick}
      className="grid size-8 shrink-0 place-items-center rounded-sm bg-ink-muted/8 text-ink-muted hover:bg-ink-muted/16 hover:text-ink"
    >
      <Icon name="close" size={18} />
    </button>
  );
}
