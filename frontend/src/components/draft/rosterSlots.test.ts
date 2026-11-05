import { describe, expect, it } from "vitest";
import type { DraftPick, LeagueSettings } from "../../api/types";
import { draftRoster } from "./rosterSlots";

const settings = {
  id: 1,
  seasonId: 1,
  rosterNumQb: 1,
  rosterNumRb: 2,
  rosterNumWr: 0,
  rosterNumTe: 0,
  rosterNumFlexWrRbTe: 1,
  rosterNumK: 1,
  rosterNumBench: 1,
} as LeagueSettings;

const pick = (overall: number, position: string): DraftPick =>
  ({
    numberPickOverall: overall,
    position,
    playerName: `${position}${overall}`,
  }) as DraftPick;

describe("draftRoster", () => {
  it("fills position slots first, then flex, then the bench", () => {
    const roster = draftRoster(settings, [
      pick(1, "RB"),
      pick(2, "RB"),
      pick(3, "RB"),
      pick(4, "RB"),
      pick(5, "QB"),
    ]);
    expect(roster.starters.map((slot) => [slot.label, slot.pick?.playerName ?? null])).toEqual([
      ["QB", "QB5"],
      ["RB", "RB1"],
      ["RB", "RB2"],
      ["FLEX", "RB3"],
      ["K", null],
    ]);
    expect(roster.bench.map((slot) => slot.pick?.playerName)).toEqual(["RB4"]);
    expect(roster.filledStarters).toBe(4);
  });

  it("keeps a player that fits no slot on an extra bench row", () => {
    const roster = draftRoster(settings, [pick(1, "K"), pick(2, "K")]);
    expect(roster.bench.map((slot) => slot.pick?.playerName)).toEqual(["K2"]);
  });
});
