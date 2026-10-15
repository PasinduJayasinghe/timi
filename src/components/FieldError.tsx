import type { ReactNode } from "react";
import { Icon } from "./Icon";

/** Inline field error (2c). */
export function FieldError({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <span id={id} className="flex items-center gap-1 text-meta font-medium text-status-error">
      <Icon name="error" size={14} />
      {children}
    </span>
  );
}
