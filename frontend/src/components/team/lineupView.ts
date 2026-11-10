import type { LineupPlayer, LineupSlot, RoundLineup } from "../../api/types";
import { BENCH_SLOT, formatKickoff, ROUND_LABELS } from "./lineup";

/** How a row is drawn: white until their game starts, green while it is on, grey once done. */
export type RowState = "ready" | "live" | "done" | "eliminated";

export const rowState = (player: LineupPlayer): RowState => {
  if (player.status === "eliminated") return "eliminated";
  if (player.gameState === "live") return "live";
  if (player.gameState === "final") return "done";
  return "ready";
};

/** The line under a name: the game's day and time, the live stats, or the final stats. */
export const playerDetail = (player: LineupPlayer): string => {
  if (player.status === "eliminated") {
    const round = player.eliminatedRound ? ROUND_LABELS[player.eliminatedRound] : null;
    return round ? `Eliminated in ${round}` : "Eliminated";
  }
  if (player.status === "bye") return "Bye · scores 0";
  if (player.gameState === "live") {
    const status = player.gameClock ? `Live ${player.gameClock}` : "Live";
    return `${status} · ${player.statLine ?? "no stats yet"}`;
  }
  if (player.gameState === "final") return player.statLine ?? "No stats";
  return player.kickoff ? formatKickoff(player.kickoff) : "Game not scheduled yet";
};

/** The slot's label on a row: the lineup layout calls the defense DEF and the bench BENCH. */
export const slotLabel = (slot: string): string => {
  if (slot === "DEF") return "DST";
  if (slot === "SUPER_FLEX") return "SFLX";
  return slot;
};

export const startersOf = (lineup: RoundLineup): LineupSlot[] =>
  lineup.slots.filter((slot) => slot.slot !== BENCH_SLOT);

export const benchPlayersOf = (lineup: RoundLineup): LineupPlayer[] => [
  ...lineup.slots
    .filter((slot) => slot.slot === BENCH_SLOT && slot.player !== null)
    .map((slot) => slot.player as LineupPlayer),
  ...lineup.unassigned,
];

/** Only the players whose team went out last round; anyone out earlier is gone from the page. */
export const eliminatedLastRound = (lineup: RoundLineup): LineupPlayer[] =>
  lineup.eliminated.filter((player) => player.eliminatedRound === lineup.round - 1);

export const sumPoints = (players: (LineupPlayer | null)[]): number =>
  Math.round(players.reduce((total, player) => total + (player?.points ?? 0), 0) * 100) / 100;

/** The round's score: the sum of its starters. Null while no starter has any stats. */
export const roundScore = (lineup: RoundLineup): number | null => {
  const starters = startersOf(lineup).map((slot) => slot.player);
  return starters.some((player) => player?.points != null) ? sumPoints(starters) : null;
};

/** Every starter with a game has finished it, and at least one did. */
export const roundIsFinal = (lineup: RoundLineup): boolean => {
  const playing = startersOf(lineup).flatMap((slot) =>
    slot.player?.gameState ? [slot.player] : [],
  );
  return playing.length > 0 && playing.every((player) => player.gameState === "final");
};

/** "WR1" and "WR2" when a layout has several slots of one name, "QB" when it has one. */
export const slotNames = (lineup: RoundLineup): Map<number, string> => {
  const totals = new Map<string, number>();
  for (const { slot } of lineup.slots) totals.set(slot, (totals.get(slot) ?? 0) + 1);
  const seen = new Map<string, number>();
  const names = new Map<number, string>();
  for (const { index, slot } of lineup.slots) {
    const nth = (seen.get(slot) ?? 0) + 1;
    seen.set(slot, nth);
    const label = slotLabel(slot);
    names.set(index, (totals.get(slot) ?? 1) > 1 ? `${label}${nth}` : label);
  }
  return names;
};
