import { describe, expect, it } from "vitest";
import type { RosterPlayer } from "../../api/types";
import { applyTap, nextGameText, parseMove, playerDragId, slotDropId } from "./lineup";

const player = (overrides: Partial<RosterPlayer> = {}): RosterPlayer => ({
  id: 1,
  name: "P",
  position: "QB",
  teamAbv: "KC",
  slot: "QB",
  isActive: true,
  nextGame: null,
  ...overrides,
});

describe("lineup helpers", () => {
  it("turns a drop on a slot into a move request", () => {
    expect(parseMove(playerDragId(7), slotDropId(3))).toEqual({ playerId: 7, slotIndex: 3 });
  });

  it("ignores drops outside a slot and non-player drags", () => {
    expect(parseMove(playerDragId(7), null)).toBeNull();
    expect(parseMove(playerDragId(7), "something-else")).toBeNull();
    expect(parseMove("empty-2", slotDropId(1))).toBeNull();
  });

  it("describes next-game status", () => {
    expect(nextGameText(player({ isActive: false }))).toBe("Eliminated");
    expect(nextGameText(player())).toBe("No upcoming game");
    expect(
      nextGameText(player({ nextGame: { opponentAbv: "DEN", gameTimeEpoch: null, status: null } })),
    ).toBe("vs DEN");
  });
});

describe("applyTap", () => {
  it("picks a player up on the first tap", () => {
    expect(applyTap(null, { index: 0, playerId: 5 })).toEqual({
      selectedPlayerId: 5,
      move: null,
    });
  });

  it("ignores a first tap on an empty slot", () => {
    expect(applyTap(null, { index: 1, playerId: null })).toEqual({
      selectedPlayerId: null,
      move: null,
    });
  });

  it("moves the picked-up player to the next tapped slot, empty or occupied", () => {
    const expected = { selectedPlayerId: null, move: { playerId: 5, slotIndex: 3 } };
    expect(applyTap(5, { index: 3, playerId: null })).toEqual(expected);
    expect(applyTap(5, { index: 3, playerId: 9 })).toEqual(expected);
  });

  it("puts the player back down when tapped again", () => {
    expect(applyTap(5, { index: 0, playerId: 5 })).toEqual({ selectedPlayerId: null, move: null });
  });
});
