import { describe, expect, it } from "vitest";
import { seasonRows } from "./seasonLines";

const line = (fields: Record<string, number>) => ({ season: "2025", playerId: 1, ...fields });

describe("seasonRows", () => {
  it("gives a quarterback passing, and rushing only when he ran", () => {
    const passing = {
      passingCompletions: 380,
      passingAttempts: 560,
      passingYards: 4306,
      passingTouchdowns: 29,
      passingInterceptions: 8,
    };
    expect(seasonRows("QB", line(passing))).toEqual([
      { label: "Passing", value: "380/560 · 4,306 yds · 29 TD · 8 INT" },
    ]);
    expect(
      seasonRows("QB", line({ ...passing, rushingYards: 531, rushingTouchdowns: 12 }))[1],
    ).toEqual({
      label: "Rushing",
      value: "531 yds · 12 TD",
    });
  });

  it("gives a receiver receiving, and rushing only with carries", () => {
    const receiving = { receivingReceptions: 108, receivingYards: 1282, receivingTouchdowns: 10 };
    expect(seasonRows("WR", line(receiving))).toEqual([
      { label: "Receiving", value: "108 rec · 1,282 yds · 10 TD" },
    ]);
    expect(seasonRows("WR", line({ ...receiving, rushingCarries: 3 }))).toHaveLength(2);
  });

  it("gives a running back rushing first, then receiving", () => {
    expect(seasonRows("RB", line({})).map((row) => row.label)).toEqual(["Rushing", "Receiving"]);
  });

  it("covers the kicker and the defense, under any spelling of the position", () => {
    expect(
      seasonRows("PK", line({ kickingFgMade: 30, kickingFgMissed: 3, kickingXpMade: 40 })),
    ).toEqual([{ label: "Kicking", value: "30/33 FG · 40/40 XP" }]);
    expect(seasonRows("DEF", line({ dstSacks: 50 }))[0]?.label).toBe("Defense");
    expect(seasonRows("LB", line({}))).toEqual([]);
  });
});
