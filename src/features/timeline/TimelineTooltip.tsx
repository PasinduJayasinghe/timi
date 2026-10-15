import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Icon, type IconName } from "../../components/Icon";

export type TooltipContent = {
  /** First line: type icon and label, e.g. "Client project · Client A". */
  icon: IconName;
  ink: string;
  heading: string;
  title: string;
  /** "8:00 pm → 9:15 pm". */
  range: string;
  duration: string;
  /** e.g. "Click to open task". */
  footer: string | null;
};

type TimelineTooltipProps = {
  content: TooltipContent;
  /** The bar it describes. */
  anchor: HTMLElement;
};

const WIDTH = 206;
const GAP = 10;
const EDGE = 8;

/** Bar tooltip (1f), above the bar unless there isn't room. Portalled so the panel can't clip it. */
export function TimelineTooltip({ content, anchor }: TimelineTooltipProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<{ style: CSSProperties; arrowLeft: number; below: boolean }>({
    style: { visibility: "hidden" },
    arrowLeft: 44,
    below: false,
  });

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const bar = anchor.getBoundingClientRect();
    const height = element.offsetHeight;
    const center = bar.left + bar.width / 2;
    const left = Math.min(Math.max(center - WIDTH / 2, EDGE), window.innerWidth - EDGE - WIDTH);
    const below = bar.top - GAP - height < EDGE;
    setPlacement({
      style: { left, top: below ? bar.bottom + GAP : bar.top - GAP - height },
      // The arrow is 10px wide; keep it clear of the rounded corners
      arrowLeft: Math.min(Math.max(center - left - 5, 12), WIDTH - 22),
      below,
    });
  }, [anchor, content.title]);

  return createPortal(
    <div
      ref={ref}
      role="tooltip"
      style={placement.style}
      className="pointer-events-none fixed z-50 flex w-51.5 flex-col gap-1.5 rounded-md border border-white bg-white/96 px-3 py-2.5 text-ink shadow-tooltip"
    >
      <div
        aria-hidden="true"
        style={{ left: placement.arrowLeft }}
        className={`absolute size-2.5 rotate-45 bg-white ${placement.below ? "-top-1.25" : "-bottom-1.25"}`}
      />
      <div className={`flex items-center gap-1.5 text-duration font-semibold ${content.ink}`}>
        <Icon name={content.icon} size={14} />
        {content.heading}
      </div>
      <div className="text-ui leading-[1.3] font-semibold">{content.title}</div>
      <div className="flex justify-between font-mono text-meta font-medium">
        <span>{content.range}</span>
        <span className="font-semibold">{content.duration}</span>
      </div>
      {content.footer && <div className="text-duration text-ink-muted">{content.footer}</div>}
    </div>,
    document.body,
  );
}
