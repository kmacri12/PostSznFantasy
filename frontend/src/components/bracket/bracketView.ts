import type { BracketGame, BracketTeam } from "../../api/types";
import { formatInViewerZone } from "../../utils/timeZone";

const abbreviation = (team: BracketTeam | null) => team?.abbreviation ?? "TBD";

/** "BUF at KC": the away team first, as the league writes it. */
export const matchupTitle = (game: BracketGame): string =>
  `${abbreviation(game.away)} at ${abbreviation(game.home)}`;

/** Final, live with the clock, or the kickoff in the viewer's zone. */
export const gameStatusText = (game: BracketGame): string => {
  if (game.state === "final") return "Final";
  if (game.state === "live") return game.clock ? `Live · ${game.clock}` : "Live";
  if (!game.kickoff) return "Time to be set";
  return formatInViewerZone(game.kickoff, { weekday: "short", hour: "numeric", minute: "2-digit" });
};

const count = (n: number, word: string) => `${n} ${word}`;

/** "2 starters, 1 bench" for the caller's players in this game; null when they have none. */
export const myPlayersSummary = (game: BracketGame): string | null => {
  const starters = game.myPlayers.filter((p) => p.role === "starter").length;
  const bench = game.myPlayers.length - starters;
  const parts = [
    starters > 0 ? count(starters, starters === 1 ? "starter" : "starters") : null,
    bench > 0 ? count(bench, "bench") : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
};

/** What a round with no games yet is waiting for. */
export const waitingText = (round: number): string =>
  round === 1 ? "Games not scheduled yet." : "Set once the previous round is final.";

/** The team that won, to dim the other one; null while the game is not final. */
export const winnerId = (game: BracketGame): number | null =>
  game.state === "final" ? game.winnerTeamId : null;
