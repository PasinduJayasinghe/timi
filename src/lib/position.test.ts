import { describe, expect, it } from "vitest";
import { positionBetween, positionForMove, topPosition } from "./position";

describe("topPosition", () => {
  it("starts at 0 for an empty list", () => {
    expect(topPosition([])).toBe(0);
  });

  it("goes above the lowest position", () => {
    expect(topPosition([3, -2, 5])).toBe(-3);
  });
});

describe("positionBetween", () => {
  it("takes the midpoint", () => {
    expect(positionBetween(1, 2)).toBe(1.5);
  });

  it("handles list edges", () => {
    expect(positionBetween(4, undefined)).toBe(5);
    expect(positionBetween(undefined, 4)).toBe(3);
    expect(positionBetween(undefined, undefined)).toBe(0);
  });
});

describe("positionForMove", () => {
  const list = [0, 1, 2, 3];

  it("moves down between the new neighbours", () => {
    // Move item at 0 to index 2 → between 2 and 3
    expect(positionForMove(list, 0, 2)).toBe(2.5);
  });

  it("moves up between the new neighbours", () => {
    // Move item at 3 to index 1 → between 0 and 1
    expect(positionForMove(list, 3, 1)).toBe(0.5);
  });

  it("moves to the top and bottom", () => {
    expect(positionForMove(list, 2, 0)).toBe(-1);
    expect(positionForMove(list, 0, 3)).toBe(4);
  });

  it("keeps the order consistent after the move", () => {
    const moved = positionForMove(list, 0, 2);
    const order = [1, 2, moved, 3];
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
});
