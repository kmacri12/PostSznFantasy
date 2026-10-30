import { describe, expect, it } from "vitest";
import type { LeagueSettings } from "../../api/types";
import { positionCaps, startingSlots } from "./preDraft";

const defaults = {
  id: 1,
  leagueId: 1,
  rosterTotal: 18,
  rosterNumQb: 1,
  rosterNumRb: 2,
  rosterNumWr: 2,
  rosterNumTe: 1,
  rosterNumFlexWrRbTe: 1,
  rosterNumFlexWrRb: 0,
  rosterNumK: 1,
  rosterNumDst: 1,
  rosterNumBench: 9,
  rosterMaxQb: 2,
  rosterMaxRb: 99,
  rosterMaxWr: 99,
  rosterMaxTe: 99,
  rosterMaxK: 2,
  rosterMaxDst: 2,
} as LeagueSettings;

describe("pre-draft roster", () => {
  it("lists only starter slots that exist, then the bench", () => {
    const { starters, bench } = startingSlots(defaults);
    expect(starters.map((s) => `${s.label}x${s.count}`)).toEqual([
      "QBx1",
      "RBx2",
      "WRx2",
      "TEx1",
      "FLEX (WR/RB/TE)x1",
      "Kx1",
      "DEFx1",
    ]);
    expect(bench).toBe(9);
  });

  it("shows uncapped positions as no limit", () => {
    const caps = Object.fromEntries(positionCaps(defaults).map((c) => [c.position, c.max]));
    expect(caps).toEqual({ QB: 2, RB: null, WR: null, TE: null, K: 2, DEF: 2 });
  });
});
