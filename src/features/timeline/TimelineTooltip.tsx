import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../../components/Icon";
import type { Session } from "../../data/types";
import { formatDuration, formatTimeOfDay } from "../../lib/duration";
import { sessionSeconds } from "../../lib/sessionMath";
import { displayTitle, sessionDisplay } from "../../lib/taskDisplay";
import { TYPE_FIELDS, TYPE_STYLES } from "../../lib/taskTypes";

type TimelineTooltipProps = {
  session: Session;
  /** The bar it describes. */
  anchor: HTMLElement;
  now: number;
  /** Shows "Click to open task" when the bar opens the task. */
  openable: boolean;
};

const WIDTH = 206;
const GAP = 10;
const EDGE = 8;

/** Bar tooltip (1f), above the bar unless there isn't room. Portalled so the panel can't clip it. */
export function TimelineTooltip({ session, anchor, now, openable }: TimelineTooltipProps) {
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
  }, [anchor, session]);

  const task = sessionDisplay(session);
  const style = TYPE_STYLES[task.type];
  const fields = TYPE_FIELDS[task.type];
  const who =
    (fields.client !== "none" ? task.clientName : null) ?? (fields.project !== "none" ? task.projectName : null);

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
      <div className={`flex items-center gap-1.5 text-duration font-semibold ${style.ink}`}>
        <Icon name={style.icon} size={14} />
        {who ? `${style.label} · ${who}` : style.label}
      </div>
      <div className="text-ui leading-[1.3] font-semibold">{displayTitle(task)}</div>
      <div className="flex justify-between font-mono text-meta font-medium">
        <span>
          {formatTimeOfDay(session.startedAt)} → {session.endedAt ? formatTimeOfDay(session.endedAt) : "now"}
        </span>
        <span className="font-semibold">{formatDuration(sessionSeconds(session, now))}</span>
      </div>
      {openable && <div className="text-duration text-ink-muted">Click to open task</div>}
    </div>,
    document.body,
  );
}
