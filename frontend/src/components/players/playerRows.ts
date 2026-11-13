import type { DraftPick, LeagueSettings, PlayerSummary } from "../../api/types";
import { normalizePosition } from "../team/moves";

/** One regular-season stat row of `GET /api/players/player-season-stats`. */
export interface SeasonStatsRow {
  playerId: number;
  /** Scored under the league's settings. */
  fantasyPoints?: number | null;
  [stat: string]: unknown;
}

export interface PlayerRow {
  id: number;
  name: string;
  position: string;
  team: string;
  eliminated: boolean;
  injuryStatus: string | null;
  scoresWholeTeam: boolean;
  points: number | null;
  /** "4,306 yds, 31 TD, 11 INT": the regular-season line for the position. */
  line: string;
  stats: SeasonStatsRow | undefined;
}

/** The fantasy team that drafted a player, and where in the draft. */
export interface Owner {
  teamId: number;
  teamName: string;
  round: number;
  pick: number;
}

export type Availability = "all" | "available" | "drafted";

export interface PlayerFilters {
  search: string;
  /** null shows every position. */
  position: string | null;
  nflTeam: string | null;
  fantasyTeamId: number | null;
  availability: Availability;
}

export const POSITION_FILTERS = ["QB", "RB", "WR", "TE", "FLEX", "K", "DST"] as const;

const num = (stats: SeasonStatsRow | undefined, key: string): number => {
  const value = stats?.[key];
  return typeof value === "number" ? value : 0;
};

const count = (value: number): string => value.toLocaleString("en-US");

/** The regular-season stat line shown under a player's name. */
export function statLine(position: string, stats: SeasonStatsRow | undefined): string {
  if (!stats) return "No regular season stats";
  const n = (key: string) => num(stats, key);
  switch (position) {
    case "QB":
      return `${count(n("passingYards"))} yds, ${n("passingTouchdowns")} TD, ${n("passingInterceptions")} INT`;
    case "RB": {
      const base = `${count(n("rushingYards"))} yds, ${n("rushingTouchdowns")} TD`;
      return n("receivingReceptions") > 0 ? `${base}, ${n("receivingReceptions")} rec` : base;
    }
    case "WR":
    case "TE":
      return `${n("receivingReceptions")} rec, ${count(n("receivingYards"))} yds, ${n("receivingTouchdowns")} TD`;
    case "K": {
      const fg = n("kickingFgMade");
      const xp = n("kickingXpMade");
      return `${fg}/${fg + n("kickingFgMissed")} FG, ${xp}/${xp + n("kickingXpMissed")} XP`;
    }
    case "DST":
      return `${n("dstSacks")} sacks, ${n("dstInterceptions")} INT, ${n("dstDefTd")} TD`;
    default:
      return "";
  }
}

export interface StatColumn {
  header: string;
  key: string;
}

const RUSH: StatColumn[] = [
  { header: "Carries", key: "rushingCarries" },
  { header: "Rush yds", key: "rushingYards" },
  { header: "Rush TD", key: "rushingTouchdowns" },
];
const RECEIVE: StatColumn[] = [
  { header: "Rec", key: "receivingReceptions" },
  { header: "Rec yds", key: "receivingYards" },
  { header: "Rec TD", key: "receivingTouchdowns" },
];

/** The stats a list can be sorted by once a position is selected. */
export const STAT_COLUMNS: Record<string, StatColumn[]> = {
  QB: [
    { header: "Pass yds", key: "passingYards" },
    { header: "Pass TD", key: "passingTouchdowns" },
    { header: "INT", key: "passingInterceptions" },
    { header: "Rush yds", key: "rushingYards" },
    { header: "Rush TD", key: "rushingTouchdowns" },
  ],
  RB: [...RUSH, ...RECEIVE],
  WR: [...RECEIVE, ...RUSH],
  TE: RECEIVE,
  FLEX: [...RECEIVE, ...RUSH],
  K: [
    { header: "FG made", key: "kickingFgMade" },
    { header: "FG missed", key: "kickingFgMissed" },
    { header: "XP made", key: "kickingXpMade" },
  ],
  DST: [
    { header: "Sacks", key: "dstSacks" },
    { header: "INT", key: "dstInterceptions" },
    { header: "Def TD", key: "dstDefTd" },
    { header: "Pts allowed", key: "dstPointsAllowed" },
  ],
};

export interface SortOption {
  key: string;
  label: string;
}

export function sortOptions(position: string | null, year: number): SortOption[] {
  return [
    { key: "points", label: `${year} pts` },
    { key: "name", label: "Name" },
    ...(position
      ? (STAT_COLUMNS[position] ?? []).map((c) => ({ key: c.key, label: c.header }))
      : []),
  ];
}

/** Positions a FLEX filter shows, from the roster's flex slots (a superflex adds QB). */
export function flexPositions(settings: LeagueSettings | undefined): string[] | null {
  if (!settings) return null;
  const slots = (key: string) => Number(settings[key]) || 0;
  const flex =
    slots("rosterNumFlexWrRbTe") +
    slots("rosterNumFlexWrRb") +
    slots("rosterNumFlexWrTe") +
    slots("rosterNumFlexQbWrRbTe");
  if (flex === 0) return null;
  return slots("rosterNumFlexQbWrRbTe") > 0 ? ["QB", "RB", "WR", "TE"] : ["RB", "WR", "TE"];
}

/**
 * The draft pool when the playoff field is set (every player on the 14 teams, with or
 * without regular season stats), otherwise everyone with a stat row.
 */
export function buildPlayerRows(pool: PlayerSummary[], stats: SeasonStatsRow[]): PlayerRow[] {
  const byId = new Map(stats.map((row) => [row.playerId, row]));
  const players: PlayerSummary[] =
    pool.length > 0
      ? pool
      : stats.flatMap((row) => {
          const player = row["player"] as PlayerSummary | undefined;
          return player ? [player] : [];
        });
  return players.map((player) => {
    const row = byId.get(player.id);
    const position = normalizePosition(player.position);
    return {
      id: player.id,
      name: player.name,
      position,
      team: player.team?.teamAbv ?? player.teamAbv ?? "FA",
      eliminated: player.eliminated ?? false,
      injuryStatus: player.injuryStatus ?? null,
      scoresWholeTeam: player.scoresWholeTeam ?? false,
      points: row?.fantasyPoints ?? null,
      line: statLine(position, row),
      stats: row,
    };
  });
}

/** Who drafted whom, from the draft's picks. */
export function ownersByPlayer(
  picks: DraftPick[],
  teamName: (teamId: number) => string,
): Map<number, Owner> {
  return new Map(
    picks.map((pick) => [
      pick.playerId,
      {
        teamId: pick.teamId,
        teamName: teamName(pick.teamId),
        round: pick.numberRound,
        pick: pick.numberPickInRound,
      },
    ]),
  );
}

export function filterRows(
  rows: PlayerRow[],
  filters: PlayerFilters,
  owners: ReadonlyMap<number, Owner>,
  flex: string[] | null,
): PlayerRow[] {
  const needle = filters.search.trim().toLowerCase();
  return rows.filter((row) => {
    if (filters.position === "FLEX") {
      if (!flex?.includes(row.position)) return false;
    } else if (filters.position !== null && row.position !== filters.position) {
      return false;
    }
    if (filters.nflTeam !== null && row.team !== filters.nflTeam) return false;
    if (needle && !row.name.toLowerCase().includes(needle)) return false;
    const owner = owners.get(row.id);
    if (filters.fantasyTeamId !== null && owner?.teamId !== filters.fantasyTeamId) return false;
    if (filters.availability === "available") return owner === undefined;
    if (filters.availability === "drafted") return owner !== undefined;
    return true;
  });
}

/** Names A to Z; points and stats high to low, with unscored players last. */
export function sortRows(rows: PlayerRow[], key: string): PlayerRow[] {
  const byName = (a: PlayerRow, b: PlayerRow) => a.name.localeCompare(b.name);
  if (key === "name") return [...rows].sort(byName);
  const value = (row: PlayerRow) =>
    key === "points" ? (row.points ?? Number.NEGATIVE_INFINITY) : num(row.stats, key);
  return [...rows].sort((a, b) => value(b) - value(a) || byName(a, b));
}
