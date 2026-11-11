import type { DraftSlot } from "../../api/types";

/** How long each team's slot stays unrevealed before the next one appears. */
export const REVEAL_STEP_MS = 1100;

/** The order to show in the lottery: by pick, first pick on top. */
export const byPick = (order: DraftSlot[]): DraftSlot[] =>
  [...order].sort((a, b) => a.slot - b.slot);

/**
 * Whether `slot` is shown after `revealed` steps. The reveal runs from the last pick up to
 * the first, like a lottery, so the first pick is the last thing anyone sees.
 */
export const isRevealed = (slot: number, teamCount: number, revealed: number): boolean =>
  slot > teamCount - revealed;
