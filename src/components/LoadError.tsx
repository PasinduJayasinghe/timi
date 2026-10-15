import { Icon } from "./Icon";

type LoadErrorProps = {
  /** e.g. "Couldn’t load your tasks". */
  title: string;
  /** What is still saved, e.g. "tasks" or "sessions". */
  subject: string;
  onRetry: () => void;
};

/** A list that failed to load (drafted, in the 3c alert style). */
export function LoadError({ title, subject, onRetry }: LoadErrorProps) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-md border border-status-error-edge/25 bg-status-error-surface/90 p-3"
    >
      <Icon name="sync_problem" size={20} className="text-status-error" />
      <div className="flex flex-1 flex-col gap-0.75">
        <span className="text-ui font-semibold">{title}</span>
        <span className="text-caption leading-[1.45] text-ink-muted">
          Your {subject} are still saved on this PC. Try again, or restart Timi if this keeps happening.
        </span>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="flex h-8 items-center gap-1 rounded-sm border border-status-error-edge/30 bg-white px-3 text-caption font-semibold text-status-error hover:bg-status-error-surface"
      >
        <Icon name="refresh" size={16} />
        Retry
      </button>
    </div>
  );
}
