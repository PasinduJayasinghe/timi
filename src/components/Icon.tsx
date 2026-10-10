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
  24: "text-[24px]",
} as const;

export type IconSize = keyof typeof SIZE_CLASS;

type IconProps = {
  /** Material Symbols Rounded ligature name, e.g. "push_pin". */
  name: string;
  size?: IconSize;
  fill?: boolean;
  className?: string;
};

export function Icon({ name, size = 18, fill = false, className = "" }: IconProps) {
  return (
    <span aria-hidden="true" className={`icon ${SIZE_CLASS[size]} ${fill ? "icon-fill" : ""} ${className}`}>
      {name}
    </span>
  );
}
