import { normalizePosition } from "../team/moves";

export const POSITION_MAX_REASON = "Position max reached";

export interface CappedPositions {
  [position: string]: string;
}

/**
 * Positions this team can't draft more of, each with the reason to show the drafter.
 * Picks carry the position as Tank01 stored it (defenses may be "DEF").
 */
export function cappedPositions(
  caps: Record<string, number>,
  rosterPositions: readonly string[],
): CappedPositions {
  const reasons: CappedPositions = {};
  for (const [position, cap] of Object.entries(caps)) {
    const held = rosterPositions.filter((p) => normalizePosition(p) === position).length;
    if (held >= cap) {
      reasons[position] = POSITION_MAX_REASON;
    }
  }
  return reasons;
}
