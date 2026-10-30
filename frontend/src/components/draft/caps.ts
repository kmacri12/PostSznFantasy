export interface CappedPositions {
  [position: string]: string;
}

/** Positions this team can't draft more of, each with the reason to show the drafter. */
export function cappedPositions(
  caps: Record<string, number>,
  rosterPositions: readonly string[],
): CappedPositions {
  const reasons: CappedPositions = {};
  for (const [position, cap] of Object.entries(caps)) {
    const held = rosterPositions.filter((p) => p === position).length;
    if (held >= cap) {
      reasons[position] =
        `You already have ${cap} ${position}${cap === 1 ? "" : "s"}, the most your league allows`;
    }
  }
  return reasons;
}
