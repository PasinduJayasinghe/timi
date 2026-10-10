import type { ButtonHTMLAttributes } from "react";
import { Icon, type IconSize } from "./Icon";

type Variant = "default" | "active" | "danger";

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  icon: string;
  label: string;
  variant?: Variant;
  iconSize?: IconSize;
  iconFill?: boolean;
  /** Shown but not wired up yet in this phase. */
  inert?: boolean;
};

const VARIANT_CLASS: Record<Variant, string> = {
  default: "bg-transparent text-ink-muted hover:bg-white/75 hover:text-ink",
  active: "bg-accent/16 text-accent-ink",
  danger: "bg-transparent text-ink-muted hover:bg-type-calendar/22 hover:text-type-calendar-ink",
};

/** 32 x 32 icon button from the title bar (1a). */
export function IconButton({
  icon,
  label,
  variant = "default",
  iconSize = 18,
  iconFill = false,
  inert = false,
  className = "",
  onClick,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-disabled={inert || undefined}
      onClick={inert ? undefined : onClick}
      className={`grid size-8 shrink-0 place-items-center rounded-sm p-0 ${VARIANT_CLASS[variant]} ${className}`}
      {...rest}
    >
      <Icon name={icon} size={iconSize} fill={iconFill} />
    </button>
  );
}
