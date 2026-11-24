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
    const status = player.gameClock ?? "Live";
    return `${status} · ${player.statLine ?? "no stats yet"}`;
  }
  if (player.gameState === "final") {
    const stats = player.statLine ?? "No stats";
    const outcome = gameOutcome(player);
    return outcome ? `${outcome.score} · ${stats}` : stats;
  }
  if (!player.kickoff) return "Game not scheduled yet";
  const when = formatKickoff(player.kickoff);
  const opponent = versus(player);
  return opponent ? `${when} ${opponent}` : when;
};

const versus = (player: LineupPlayer): string | null =>
  player.opponentAbv ? `${player.isHome ? "vs" : "@"} ${player.opponentAbv}` : null;

export interface GameOutcome {
  /** Leads the line, in capitals: what the result means for him in this format. */
  word: string;
  won: boolean;
  /** "27-20", his team's score first. */
  score: string;
}

/**
 * What a finished game means for him: a loss ends his playoffs, a win moves him on (the Super
 * Bowl's winner is the champion). Null without a final score, on a bye, once already eliminated.
 */
export const gameOutcome = (player: LineupPlayer, superBowl = false): GameOutcome | null => {
  const { teamScore: own, opponentScore: theirs } = player;
  if (player.gameState !== "final" || player.status === "eliminated") return null;
  if (own === null || theirs === null || own === theirs) return null;
  const won = own > theirs;
  return {
    word: won ? (superBowl ? "CHAMPION" : "ADVANCES") : "ELIMINATED",
    won,
    score: `${own}-${theirs}`,
  };
};

export type PlayerStatus = "advanced" | "live" | "toPlay" | "eliminated";

/** Display order, and the order of the squares: green, blue, grey, then red at the end. */
export const PLAYER_STATUSES: PlayerStatus[] = ["advanced", "live", "toPlay", "eliminated"];

/**
 * Where a rostered player stands in a round: through (won, or on a bye), playing, waiting, or out.
 * Nobody is eliminated from the Super Bowl (`round` 4), so a finished one leaves both finalists'
 * players "advanced": only a team that ran out of players before it is out.
 */
export const playerStatus = (player: LineupPlayer, round = 0): PlayerStatus => {
  if (player.status === "eliminated") return "eliminated";
  if (player.status === "bye") return "advanced";
  if (player.gameState === "live") return "live";
  const outcome = gameOutcome(player);
  if (outcome) return outcome.won || round === 4 ? "advanced" : "eliminated";
  return "toPlay";
};

export interface RosterStatus {
  round: number;
  /** One entry per rostered player, in `PLAYER_STATUSES` order. */
  statuses: PlayerStatus[];
  counts: Record<PlayerStatus, number>;
  /** Everyone not eliminated. */
  left: number;
}

/**
 * The whole roster's standing in the round on display (`round`, the standings' round, which
 * switches Thursday morning so the dots and the League header change together), so a win stays
 * "advanced" until then, when everyone left becomes to play. Without it, the latest round whose
 * first kickoff has passed. Null for an empty roster.
 */
export const rosterStatus = (
  lineups: RoundLineup[],
  now: Date,
  round?: number,
): RosterStatus | null => {
  const started = lineups.filter(
    (lineup) => lineup.firstKickoff && new Date(lineup.firstKickoff) <= now,
  );
  const lineup = lineups.find((entry) => entry.round === round) ?? started.at(-1) ?? lineups[0];
  if (!lineup) return null;
  const players = [
    ...lineup.slots.flatMap((slot) => (slot.player ? [slot.player] : [])),
    ...lineup.unassigned,
    ...lineup.eliminated,
  ];
  if (players.length === 0) return null;
  const counts: Record<PlayerStatus, number> = { advanced: 0, live: 0, toPlay: 0, eliminated: 0 };
  for (const player of players) counts[playerStatus(player, lineup.round)] += 1;
  const statuses = PLAYER_STATUSES.flatMap((status) =>
    Array.from({ length: counts[status] }, () => status),
  );
  return { round: lineup.round, statuses, counts, left: players.length - counts.eliminated };
};

/** The slot's label on a row: the lineup layout calls the superflex SUPER_FLEX. */
export const slotLabel = (slot: string): string => (slot === "SUPER_FLEX" ? "SFLX" : slot);

export const startersOf = (lineup: RoundLineup): LineupSlot[] =>
  lineup.slots.filter((slot) => slot.slot !== BENCH_SLOT);

const POSITION_ORDER = ["QB", "RB", "WR", "TE", "K", "DST"];
const positionRank = (position: string): number => {
  const rank = POSITION_ORDER.indexOf(position);
  return rank === -1 ? POSITION_ORDER.length : rank;
};

/**
 * Players in bench slots and players in no slot, as one list in the API's `bench_order`
 * (QB, RB, WR, TE, K, DST, then name), so a starter moved to the bench lands in place.
 */
export const benchPlayersOf = (lineup: RoundLineup): LineupPlayer[] =>
  [
    ...lineup.slots
      .filter((slot) => slot.slot === BENCH_SLOT && slot.player !== null)
      .map((slot) => slot.player as LineupPlayer),
    ...lineup.unassigned,
  ].sort(
    (a, b) =>
      positionRank(a.position) - positionRank(b.position) ||
      (a.name < b.name ? -1 : a.name > b.name ? 1 : 0),
  );

/** The page element the "Go to bench" button of the hurt-starter banner scrolls to. */
export const BENCH_GROUP_ID = "lineup-bench";

const HURT_LABELS: Record<string, string> = {
  Out: "Out",
  Doubtful: "Doubtful",
  "Injured Reserve": "on injured reserve",
};

/** Starters ruled Out, Doubtful or on IR whose game has not started, so they can still be swapped. */
export const hurtStarters = (lineup: RoundLineup): LineupPlayer[] =>
  startersOf(lineup).flatMap(({ player }) =>
    player &&
    player.status === "alive" &&
    !player.locked &&
    player.injuryStatus &&
    player.injuryStatus in HURT_LABELS
      ? [player]
      : [],
  );

/** The banner's sentence: who is hurt and that there is time to swap. */
export const hurtStartersMessage = (hurt: LineupPlayer[]): string => {
  const [first] = hurt;
  if (hurt.length === 1 && first) {
    const label = HURT_LABELS[first.injuryStatus ?? ""] ?? "hurt";
    return `${first.name} is ${label}. Swap him out before his game starts.`;
  }
  return `${hurt.length} starters are hurt: ${hurt.map((player) => player.name).join(", ")}. Swap them out before their games start.`;
};

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

export interface PostseasonLine {
  round: number;
  statLine: string;
  points: number;
}

/** A player's finished games in the rounds before `beforeRound`, oldest first, for his sheet. */
export const postseasonLines = (
  lineups: RoundLineup[],
  playerId: number,
  beforeRound: number,
): PostseasonLine[] =>
  lineups
    .filter((lineup) => lineup.round < beforeRound)
    .sort((a, b) => a.round - b.round)
    .flatMap((lineup) => {
      const player = [
        ...lineup.slots.map((slot) => slot.player),
        ...lineup.unassigned,
        ...lineup.eliminated,
      ].find((entry) => entry?.id === playerId);
      return player?.gameState === "final" && player.statLine
        ? [{ round: lineup.round, statLine: player.statLine, points: player.points ?? 0 }]
        : [];
    });
