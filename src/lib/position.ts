/**
 * Fractional sort positions: moving a task only rewrites that task's position,
 * halfway between its new neighbours. Lower positions sort first.
 */

/** Position for a new task at the top of a list. */
export function topPosition(positions: readonly number[]): number {
  return positions.length === 0 ? 0 : Math.min(...positions) - 1;
}

/** Position between two neighbours; either side may be missing (list edge). */
export function positionBetween(before: number | undefined, after: number | undefined): number {
  if (before !== undefined && after !== undefined) return (before + after) / 2;
  if (before !== undefined) return before + 1;
  if (after !== undefined) return after - 1;
  return 0;
}

/**
 * New position for the item at `from` after moving it to index `to`
 * within an ordered list of positions.
 */
export function positionForMove(positions: readonly number[], from: number, to: number): number {
  const rest = positions.filter((_, index) => index !== from);
  return positionBetween(rest[to - 1], rest[to]);
}
