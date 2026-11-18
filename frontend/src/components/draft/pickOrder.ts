import type { DraftState } from "../../api/types";

/** Whether a round (0-based) runs from the last slot to the first. */
export const isReversedRound = (draftType: DraftState["draftType"], round: number): boolean =>
  draftType === "snake"
    ? round % 2 === 1
    : draftType === "third_round_reversal"
      ? round === 1 || (round >= 2 && round % 2 === 0)
      : false;

/** The team that holds overall pick `overall` (1-based), or null past the end or without an order. */
export const teamOnPick = (state: DraftState, overall: number): number | null => {
  const slots = [...state.order].sort((a, b) => a.slot - b.slot);
  if (slots.length === 0 || overall < 1 || overall > state.totalPicks) return null;
  const round = Math.floor((overall - 1) / slots.length);
  const index = (overall - 1) % slots.length;
  const reversed = isReversedRound(state.draftType, round);
  return slots[reversed ? slots.length - 1 - index : index]?.teamId ?? null;
};

/** Picks from the one on the clock to my next one: 1 = on deck. Null when I have none left. */
export const picksUntilMyPick = (state: DraftState, myTeamId: number | null): number | null => {
  if (myTeamId === null || state.currentPickOverall === null) return null;
  // The server names the first two; the order only has to answer for the picks after them.
  if (state.onTheClockTeamId === myTeamId) return 0;
  if (state.onDeckTeamId === myTeamId) return 1;
  for (let overall = state.currentPickOverall + 2; overall <= state.totalPicks; overall++) {
    if (teamOnPick(state, overall) === myTeamId) return overall - state.currentPickOverall;
  }
  return null;
};

/** "On deck", "3 picks away"; null on my own turn or with no pick of mine ahead. */
export const picksAwayLabel = (state: DraftState, myTeamId: number | null): string | null => {
  if (state.status !== "in_progress" && state.status !== "paused") return null;
  const away = picksUntilMyPick(state, myTeamId);
  if (away === null || away === 0) return null;
  return away === 1 ? "On deck" : `${away} picks away`;
};
