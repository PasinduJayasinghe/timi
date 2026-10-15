import type { IconName } from "../components/Icon";
import type { SummaryKey } from "./sessionMath";

export type SummaryStyle = {
  /** Short label: Log totals (3f) and wide timeline rows (1d). */
  label: string;
  /** Full name: timeline row tile tooltip (1a). */
  title: string;
  icon: IconName;
  ink: string;
  /** Row tile background (1a). */
  tint: string;
  /** Solid colour in the Log's stacked bar (3f). */
  solid: string;
};

/**
 * Log totals and timeline rows. Meetings use the calendar colour and icon, as in the design,
 * because calendar events join the row in Phase 5. Class names are written out for Tailwind.
 */
export const SUMMARY_STYLES: Record<SummaryKey, SummaryStyle> = {
  client: {
    label: "Client",
    title: "Client project",
    icon: "work",
    ink: "text-type-client-ink",
    tint: "bg-type-client/18",
    solid: "bg-type-client",
  },
  internal: {
    label: "Internal",
    title: "Internal project",
    icon: "folder",
    ink: "text-type-internal-ink",
    tint: "bg-type-internal/20",
    solid: "bg-type-internal",
  },
  support: {
    label: "Support",
    title: "Support ticket",
    icon: "confirmation_number",
    ink: "text-type-support-ink",
    tint: "bg-type-support/18",
    solid: "bg-type-support",
  },
  meetings: {
    label: "Meetings",
    title: "Meetings",
    icon: "videocam",
    ink: "text-type-calendar-ink",
    tint: "bg-type-calendar/20",
    solid: "bg-type-calendar",
  },
  other: {
    label: "Other",
    title: "Other",
    icon: "category",
    ink: "text-type-other-ink",
    tint: "bg-type-other/22",
    solid: "bg-type-other",
  },
};
