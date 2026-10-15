import { useLiveSeconds } from "../hooks/useNow";
import { formatClock, formatDuration } from "../lib/duration";

/** A total that keeps counting while a session runs: closed seconds plus the running session. */
export type LiveTotal = {
  baseSeconds: number;
  /** Start of the running session counted in this total, if any. */
  runningSince: string | null;
};

type LiveDurationProps = LiveTotal & {
  /** "duration" is "4h 19m"; "clock" is the live timer "24:13". */
  format?: "duration" | "clock";
};

/** Renders a live total. Only this text re-renders each second, not its parent. */
export function LiveDuration({ baseSeconds, runningSince, format = "duration" }: LiveDurationProps) {
  const seconds = useLiveSeconds(baseSeconds, runningSince);
  return <>{format === "clock" ? formatClock(seconds) : formatDuration(seconds)}</>;
}
