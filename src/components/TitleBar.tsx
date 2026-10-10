import type { MouseEvent, ReactNode } from "react";
import { formatTitleDate } from "../lib/date";
import { startDrag } from "../lib/window";
import { IconButton } from "./IconButton";

export function handleDragMouseDown(event: MouseEvent<HTMLElement>): void {
  if (event.button === 0) {
    void startDrag();
  }
}

export function LogoMark({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`size-4.5 shrink-0 rounded-xs bg-accent-gradient ${className}`} />;
}

type TitleBarProps = {
  date: Date;
  pinned: boolean;
  wide: boolean;
  onTogglePin: () => void;
  onToggleWide: () => void;
  onCollapse: () => void;
  onClose: () => void;
  /** Wide mode only: the "Today + Calendar / Log" switcher. */
  switcher?: ReactNode;
};

/** Custom title bar, 48px (1a; 1d in wide mode). */
export function TitleBar({
  date,
  pinned,
  wide,
  onTogglePin,
  onToggleWide,
  onCollapse,
  onClose,
  switcher,
}: TitleBarProps) {
  const dateLabel = (
    <>
      <LogoMark className="shadow-mark" />
      <span className="truncate text-ui font-semibold tracking-title">{formatTitleDate(date)}</span>
    </>
  );

  return (
    <div className="relative z-1 flex h-12 shrink-0 items-center gap-0.5 pr-2 pl-3.5">
      {wide ? (
        <>
          <div
            title="Drag to move"
            onMouseDown={handleDragMouseDown}
            className="mr-4 flex h-full cursor-grab items-center gap-2.5"
          >
            {dateLabel}
          </div>
          {switcher}
          <div aria-hidden="true" onMouseDown={handleDragMouseDown} className="h-full flex-1 cursor-grab" />
          <IconButton icon="settings" label="Settings" inert />
        </>
      ) : (
        <div
          title="Drag to move"
          onMouseDown={handleDragMouseDown}
          className="flex h-full min-w-0 flex-1 cursor-grab items-center gap-2.5"
        >
          {dateLabel}
        </div>
      )}
      <IconButton
        icon="push_pin"
        label="Always on top"
        aria-pressed={pinned}
        variant={pinned ? "active" : "default"}
        iconFill={pinned}
        onClick={onTogglePin}
      />
      <IconButton
        icon="width"
        label="Wide mode"
        aria-pressed={wide}
        variant={wide ? "active" : "default"}
        onClick={onToggleWide}
      />
      <IconButton icon="close_fullscreen" label="Collapse to mini bar" onClick={onCollapse} />
      <IconButton icon="close" label="Close" variant="danger" onClick={onClose} />
    </div>
  );
}
