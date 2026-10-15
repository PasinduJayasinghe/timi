export const TASK_TYPES = ["client", "internal", "support", "meeting", "other"] as const;

export type TaskType = (typeof TASK_TYPES)[number];

export type TaskTypeStyle = {
  label: string;
  short: string;
  icon: string;
  /** Text colour for the type (icons, labels). */
  ink: string;
  /** Icon tile and soft chip background. */
  tint: string;
  /** Filter chip when active (1a script: tint at 32%, edge colour, strong ink). */
  chipActive: string;
  /** Filter chip when inactive in wide mode (1d). */
  chipWide: string;
  /** Picker row highlight (2b: type colour at 14%). */
  pickerActive: string;
  /** Type chip in the details popover (2d: type colour at 16%). */
  chipSoft: string;
};

/**
 * Per-type styling from the token sheet and the 1a/1d/2b screens.
 * Class names are written out in full so Tailwind can find them.
 */
export const TYPE_STYLES: Record<TaskType, TaskTypeStyle> = {
  client: {
    label: "Client project",
    short: "Client",
    icon: "work",
    ink: "text-type-client-ink",
    tint: "bg-type-client/18",
    chipActive: "bg-type-client/32 border-type-client/65 text-type-client-ink-strong",
    chipWide: "bg-type-client/14 text-type-client-ink",
    pickerActive: "bg-type-client/14",
    chipSoft: "bg-type-client/16",
  },
  internal: {
    label: "Internal project",
    short: "Internal",
    icon: "folder",
    ink: "text-type-internal-ink",
    tint: "bg-type-internal/20",
    chipActive: "bg-type-internal/32 border-type-internal/70 text-type-internal-ink-strong",
    chipWide: "bg-type-internal/16 text-type-internal-ink",
    pickerActive: "bg-type-internal/14",
    chipSoft: "bg-type-internal/16",
  },
  support: {
    label: "Support ticket",
    short: "Support",
    icon: "confirmation_number",
    ink: "text-type-support-ink",
    tint: "bg-type-support/18",
    chipActive: "bg-type-support/32 border-type-support/70 text-type-support-ink-strong",
    chipWide: "bg-type-support/14 text-type-support-ink",
    pickerActive: "bg-type-support/14",
    chipSoft: "bg-type-support/16",
  },
  meeting: {
    label: "Meeting",
    short: "Meeting",
    icon: "groups",
    ink: "text-type-meeting-ink",
    tint: "bg-type-meeting/20",
    chipActive: "bg-type-meeting/32 border-type-meeting/80 text-type-meeting-ink-strong",
    chipWide: "bg-type-meeting/16 text-type-meeting-ink",
    pickerActive: "bg-type-meeting/14",
    chipSoft: "bg-type-meeting/16",
  },
  other: {
    label: "Other",
    short: "Other",
    icon: "category",
    ink: "text-type-other-ink",
    tint: "bg-type-other/22",
    chipActive: "bg-type-other/32 border-type-other/80 text-type-other-ink-strong",
    chipWide: "bg-type-other/20 text-type-other-ink",
    pickerActive: "bg-type-other/14",
    chipSoft: "bg-type-other/16",
  },
};

/** Which catalog fields each type uses (from the 2a sheet; meeting and other from the 1a data). */
export type TypeFields = {
  client: "required" | "optional" | "none";
  project: "client" | "internal" | "none";
  ticket: boolean;
};

export const TYPE_FIELDS: Record<TaskType, TypeFields> = {
  client: { client: "required", project: "client", ticket: false },
  internal: { client: "none", project: "internal", ticket: false },
  support: { client: "optional", project: "none", ticket: true },
  meeting: { client: "optional", project: "none", ticket: false },
  other: { client: "none", project: "none", ticket: false },
};

export function isTaskType(value: string): value is TaskType {
  return (TASK_TYPES as readonly string[]).includes(value);
}
