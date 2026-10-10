import { Icon } from "./Icon";
import { IconButton } from "./IconButton";
import { handleDragMouseDown, LogoMark } from "./TitleBar";

type MiniBarProps = {
  total: string;
  onExpand: () => void;
};

/**
 * Collapsed mini bar, idle state (1e, fourth bar). The " · next: …" meeting hint arrives with Phase 5.
 * The design's 85% surface sits on the app gradient here, so the desktop doesn't show through
 * the transparent window.
 */
export function MiniBar({ total, onExpand }: MiniBarProps) {
  return (
    <div className="h-full w-full overflow-hidden rounded-panel bg-app">
      <div
        onMouseDown={handleDragMouseDown}
        className="flex h-full w-full cursor-grab items-center gap-2 rounded-panel border border-white/90 bg-mini/85 pr-2 pl-3.5 text-ink"
      >
        <LogoMark />
        <div className="flex min-w-0 flex-1 flex-col leading-[1.2]">
          <span className="truncate text-ui font-semibold">No timer running</span>
          <span className="text-duration text-ink-muted">
            Today <span className="font-mono">{total}</span>
          </span>
        </div>
        <button
          type="button"
          aria-disabled="true"
          onMouseDown={(event) => {
            event.stopPropagation();
          }}
          className="flex h-8 items-center gap-1 rounded-cta-sm pr-3 pl-2 text-caption font-semibold text-white bg-accent-gradient-strong hover:-translate-y-px"
        >
          <Icon name="play_arrow" size={18} fill />
          Start
        </button>
        <IconButton
          icon="open_in_full"
          label="Expand"
          onClick={onExpand}
          onMouseDown={(event) => {
            event.stopPropagation();
          }}
        />
      </div>
    </div>
  );
}
