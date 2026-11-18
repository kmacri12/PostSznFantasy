import { describe, expect, it } from "vitest";
import { cappedPositions, POSITION_MAX_REASON } from "./caps";

describe("cappedPositions", () => {
  it("flags only positions where the roster has reached the cap", () => {
    const reasons = cappedPositions({ QB: 2, K: 2 }, ["QB", "QB", "K", "RB"]);
    expect(Object.keys(reasons)).toEqual(["QB"]);
    expect(reasons.QB).toBe(POSITION_MAX_REASON);
    expect(POSITION_MAX_REASON).toBe("Position max reached");
  });

  it("counts defenses stored under Tank01's raw positions", () => {
    expect(Object.keys(cappedPositions({ K: 1, DST: 1 }, ["K", "DEF"]))).toEqual(["K", "DST"]);
    expect(Object.keys(cappedPositions({ DST: 1 }, ["D/ST"]))).toEqual(["DST"]);
  });

  it("flags nothing for an empty roster", () => {
    expect(cappedPositions({ QB: 2 }, [])).toEqual({});
  });
});
