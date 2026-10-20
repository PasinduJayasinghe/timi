import { styleOf } from "../lib/taskTypes";
import { Icon } from "./Icon";

const SIZES = {
  /** 24px: compact lists (sheets, the schedule tray). */
  sm: { box: "size-6 rounded-[7px]", icon: 14 },
  /** 26px: the 2a Recent list and Plan my day leftovers. */
  md: { box: "size-6.5 rounded-[8px]", icon: 15 },
} as const;

/** A task's type icon on its tinted tile. */
export function TypeTile({ task, size = "sm" }: { task: Parameters<typeof styleOf>[0]; size?: keyof typeof SIZES }) {
  const style = styleOf(task);
  const { box, icon } = SIZES[size];
  return (
    <span aria-hidden="true" className={`grid shrink-0 place-items-center ${box} ${style.tint} ${style.ink}`}>
      <Icon name={style.icon} size={icon} />
    </span>
  );
}
