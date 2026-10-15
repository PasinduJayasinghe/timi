import type { CloudSync } from "../hooks/useCloudSync";
import { syncTooltip } from "../lib/cloudSync";
import { Icon } from "./Icon";

const CHIP = {
  saved: { icon: "cloud_done", label: "Saved", colours: "bg-type-support/16 text-type-support-ink" },
  syncing: { icon: "sync", label: "Syncing", colours: "bg-type-internal/18 text-type-internal-ink" },
  offline: {
    icon: "cloud_off",
    label: "Offline · saved on this device",
    colours: "bg-ink-muted/12 text-type-other-ink",
  },
} as const;

/**
 * Footer sync chip (2e): Saved, Syncing (spinning; still with reduce motion) or Offline. Offline
 * is a button that retries (drafted). Nothing shows when this build has no Supabase project.
 */
export function SyncChip({ sync }: { sync: CloudSync }) {
  if (sync.status === "off") return null;
  const chip = CHIP[sync.status];
  const tooltip = syncTooltip(sync.status, sync.error, sync.pending);
  const body = (
    <span
      className={`flex h-6.5 items-center gap-1.25 rounded-[13px] pr-2.5 pl-2 text-meta font-semibold ${chip.colours}`}
    >
      <Icon name={chip.icon} size={15} className={sync.status === "syncing" ? "animate-spin" : ""} />
      {chip.label}
    </span>
  );

  if (sync.status === "offline") {
    return (
      <button
        type="button"
        title={`${tooltip}. Click to try again.`}
        aria-label={`${chip.label}. ${tooltip}. Try again`}
        onClick={sync.retry}
        className="-my-0.75 flex h-8 items-center rounded-[13px] hover:brightness-95"
      >
        {body}
      </button>
    );
  }
  return (
    <span role="status" title={tooltip} aria-label={`${chip.label}. ${tooltip}`} className="flex items-center">
      {body}
    </span>
  );
}
