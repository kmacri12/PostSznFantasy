import { describe, expect, it } from "vitest";
import type { LineupPlayer, RoundLineup } from "../../api/types";
import {
  applyTap,
  defaultRound,
  emptyLineupWarning,
  lineupStatusText,
  parseMove,
  playerDragId,
  slotDropId,
  UNASSIGNED_DROP_ID,
} from "./lineup";

const player = (overrides: Partial<LineupPlayer> = {}): LineupPlayer => ({
  id: 1,
  name: "P",
  position: "QB",
  teamAbv: "KC",
  isActive: true,
  nextGame: null,
  status: "alive",
  kickoff: null,
  locked: false,
  ...overrides,
});

const lineup = (round: number, overrides: Partial<RoundLineup> = {}): RoundLineup => ({
  round,
  slots: [],
  unassigned: [],
  eliminated: [],
  emptyStarterSlots: 0,
  firstKickoff: null,
  ...overrides,
});

const NOW = new Date("2026-01-10T12:00:00Z");
const LATER = "2026-01-11T18:00:00Z";
const EARLIER = "2026-01-09T18:00:00Z";

describe("lineup helpers", () => {
  it("turns a drop on a slot into a move request", () => {
    expect(parseMove(playerDragId(7), slotDropId(3))).toEqual({ playerId: 7, slotIndex: 3 });
  });

  it("turns a drop on the unassigned section into taking the player out", () => {
    expect(parseMove(playerDragId(7), UNASSIGNED_DROP_ID)).toEqual({
      playerId: 7,
      slotIndex: null,
    });
  });

  it("ignores drops outside a slot and non-player drags", () => {
    expect(parseMove(playerDragId(7), null)).toBeNull();
    expect(parseMove(playerDragId(7), "something-else")).toBeNull();
    expect(parseMove("empty-2", slotDropId(1))).toBeNull();
  });

  it("explains why a player is or is not movable", () => {
    expect(lineupStatusText(player({ status: "eliminated" }))).toBe("Eliminated");
    expect(lineupStatusText(player({ status: "bye" }))).toBe("Bye · scores 0");
    expect(lineupStatusText(player())).toBe("Game not scheduled yet");
    expect(lineupStatusText(player({ kickoff: LATER }))).toMatch(/^Locks at kickoff/);
    expect(lineupStatusText(player({ kickoff: EARLIER, locked: true }))).toMatch(/^Locked/);
  });
});

describe("applyTap", () => {
  const open = { locked: false };

  it("picks a player up on the first tap", () => {
    expect(applyTap(null, { index: 0, playerId: 5, ...open })).toEqual({
      selectedPlayerId: 5,
      move: null,
    });
  });

  it("ignores a first tap on an empty slot", () => {
    expect(applyTap(null, { index: 1, playerId: null, ...open })).toEqual({
      selectedPlayerId: null,
      move: null,
    });
  });

  it("moves the picked-up player to the next tapped slot, empty or occupied", () => {
    const expected = { selectedPlayerId: null, move: { playerId: 5, slotIndex: 3 } };
    expect(applyTap(5, { index: 3, playerId: null, ...open })).toEqual(expected);
    expect(applyTap(5, { index: 3, playerId: 9, ...open })).toEqual(expected);
  });

  it("puts the player back down when tapped again", () => {
    expect(applyTap(5, { index: 0, playerId: 5, ...open })).toEqual({
      selectedPlayerId: null,
      move: null,
    });
  });

  it("refuses to pick up a locked player", () => {
    expect(applyTap(null, { index: 0, playerId: 5, locked: true })).toEqual({
      selectedPlayerId: null,
      move: null,
    });
  });

  it("refuses to swap a locked player out, keeping the pick-up", () => {
    expect(applyTap(5, { index: 3, playerId: 9, locked: true })).toEqual({
      selectedPlayerId: 5,
      move: null,
    });
  });
});

describe("empty lineup warning", () => {
  it("names the nearest round with open starter slots before kickoff", () => {
    const lineups = [
      lineup(1, { emptyStarterSlots: 3, firstKickoff: EARLIER }),
      lineup(2, { emptyStarterSlots: 2, firstKickoff: LATER }),
    ];
    expect(emptyLineupWarning(lineups, 18, NOW)).toEqual({
      round: 2,
      emptyStarterSlots: 2,
      firstKickoff: LATER,
    });
  });

  it("is gone once the lineup is full or the round has kicked off", () => {
    expect(emptyLineupWarning([lineup(1, { firstKickoff: LATER })], 18, NOW)).toBeNull();
    expect(
      emptyLineupWarning([lineup(1, { emptyStarterSlots: 4, firstKickoff: EARLIER })], 18, NOW),
    ).toBeNull();
  });

  it("stays quiet before the draft fills a roster or while kickoff is unknown", () => {
    const empty = lineup(1, { emptyStarterSlots: 9, firstKickoff: LATER });
    expect(emptyLineupWarning([empty], 0, NOW)).toBeNull();
    expect(emptyLineupWarning([lineup(1, { emptyStarterSlots: 9 })], 18, NOW)).toBeNull();
  });
});

describe("defaultRound", () => {
  it("opens on the first round that has not kicked off", () => {
    const lineups = [
      lineup(1, { firstKickoff: EARLIER }),
      lineup(2, { firstKickoff: LATER }),
      lineup(3),
      lineup(4),
    ];
    expect(defaultRound(lineups, NOW)).toBe(2);
  });

  it("falls back to the latest scheduled round, then round one", () => {
    expect(defaultRound([lineup(1, { firstKickoff: EARLIER }), lineup(2)], NOW)).toBe(1);
    expect(defaultRound([lineup(1), lineup(2)], NOW)).toBe(1);
  });
});
