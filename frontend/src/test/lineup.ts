import type { LineupPlayer, LineupSlot, RoundLineup } from "../api/types";

export const lineupPlayer = (overrides: Partial<LineupPlayer> = {}): LineupPlayer => ({
  id: 1,
  name: "Player",
  position: "QB",
  teamAbv: "KC",
  isActive: true,
  nextGame: null,
  status: "alive",
  kickoff: null,
  locked: false,
  gameState: null,
  gameClock: null,
  points: null,
  statLine: null,
  eliminatedRound: null,
  scoreChange: null,
  ...overrides,
});

export const slot = (
  index: number,
  name: string,
  player: LineupPlayer | null = null,
): LineupSlot => ({ index, slot: name, player, mark: null });

export const roundLineup = (round: number, overrides: Partial<RoundLineup> = {}): RoundLineup => ({
  round,
  slots: [],
  unassigned: [],
  eliminated: [],
  emptyStarterSlots: 0,
  firstKickoff: null,
  ...overrides,
});
