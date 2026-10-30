import { describe, expect, it } from "vitest";
import { cappedPositions } from "./caps";

describe("cappedPositions", () => {
  it("flags only positions where the roster has reached the cap", () => {
    const reasons = cappedPositions({ QB: 2, K: 2 }, ["QB", "QB", "K", "RB"]);
    expect(Object.keys(reasons)).toEqual(["QB"]);
    expect(reasons.QB).toBe("You already have 2 QBs, the most your league allows");
  });

  it("uses the singular for a cap of one", () => {
    expect(cappedPositions({ DST: 1 }, ["DST"]).DST).toBe(
      "You already have 1 DST, the most your league allows",
    );
  });

  it("flags nothing for an empty roster", () => {
    expect(cappedPositions({ QB: 2 }, [])).toEqual({});
  });
});
