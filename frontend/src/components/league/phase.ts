/**
 * Once the draft is done, lineups stay open until the first Wild Card kickoff; after that,
 * or as soon as the standings show a live or final game, the playoffs are under way.
 */
export const afterDraftPhase = ({
  firstKickoff,
  gamesStarted,
  now,
}: {
  /** First Wild Card kickoff, when the lineups first lock; null when unknown. */
  firstKickoff: string | null;
  gamesStarted: boolean;
  now: number;
}): "lineup" | "playoffs" =>
  firstKickoff !== null && now < Date.parse(firstKickoff) && !gamesStarted ? "lineup" : "playoffs";
