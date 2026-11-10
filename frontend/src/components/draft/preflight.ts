import type { DraftState } from "../../api/types";

const DRAFT_TYPE_LABEL = {
  snake: "snake",
  linear: "linear",
  third_round_reversal: "third-round reversal",
} as const;

export interface Preflight {
  /** Nothing in the order is missing, so Start may be enabled. */
  orderComplete: boolean;
  lines: string[];
  warnings: string[];
}

const nameList = (names: string[]): string => names.join(", ");

/** What starting the draft will lock in, in the words a commissioner checks before the tap. */
export const preflight = (draft: DraftState, onlineUserIds: number[]): Preflight => {
  const teamCount = draft.order.length + draft.unassignedTeamIds.length;
  const orderComplete = draft.unassignedTeamIds.length === 0 && draft.order.length > 0;
  const owned = draft.order.filter((slot) => slot.ownerName !== null);
  const unowned = draft.order.filter((slot) => slot.ownerName === null);
  const online = owned.filter(
    (slot) => slot.ownerUserId !== null && onlineUserIds.includes(slot.ownerUserId),
  );
  const first = draft.order[0];

  const lines = [
    `${owned.length} of ${teamCount} teams have an owner.`,
    `${draft.rounds} rounds, ${DRAFT_TYPE_LABEL[draft.draftType]}, ${draft.timePerPickSeconds} seconds per pick.`,
  ];
  if (first) lines.push(`The first pick belongs to ${first.teamName}.`);
  lines.push(
    online.length > 0
      ? `In the room now: ${nameList(online.map((slot) => slot.ownerName ?? ""))}.`
      : "Nobody is in the room yet.",
  );

  const warnings: string[] = [];
  if (!orderComplete) warnings.push("Every team needs a draft slot before you can start.");
  if (unowned.length > 0)
    warnings.push(
      `${unowned.length} ${unowned.length === 1 ? "team has" : "teams have"} no owner and will be auto-picked: ${nameList(unowned.map((slot) => slot.teamName))}.`,
    );
  const missing = owned.filter((slot) => !online.includes(slot));
  if (missing.length > 0 && online.length > 0)
    warnings.push(`Not in the room: ${nameList(missing.map((slot) => slot.ownerName ?? ""))}.`);
  return { orderComplete, lines, warnings };
};
