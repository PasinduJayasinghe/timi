import { ICONS, type IconName } from "./icons";

export type { IconName } from "./icons";

/** Icon sizes used in the design, in px. Listed as full class names so Tailwind can see them. */
const SIZE_CLASS = {
  13: "text-[13px]",
  14: "text-[14px]",
  15: "text-[15px]",
  16: "text-[16px]",
  17: "text-[17px]",
  18: "text-[18px]",
  19: "text-[19px]",
  20: "text-[20px]",
  22: "text-[22px]",
  24: "text-[24px]",
} as const;

export type IconSize = keyof typeof SIZE_CLASS;

type IconProps = {
  /** A Material Symbols Rounded icon from components/icons.ts, e.g. "push_pin". */
  name: IconName;
  size?: IconSize;
  fill?: boolean;
  className?: string;
};

/** Material Symbols Rounded icon, drawn as inline SVG in the current text colour (Phase 6b). */
export function Icon({ name, size = 18, fill = false, className = "" }: IconProps) {
  const [outline, filled] = ICONS[name];
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 -960 960 960"
      className={`icon ${SIZE_CLASS[size]} ${className}`}
    >
      <path d={fill ? filled : outline} />
    </svg>
  );
}
