export interface PlayerInfo {
  id?: number;
  name?: string;
  position?: string;
  teamAbv?: string | null;
  team?: { teamAbv?: string | null } | null;
}

export interface PlayerSeasonStats {
  season: string;
  playerId: number;
  player?: PlayerInfo;
  /** Scored under the selected league's settings; null when no league is selected. */
  fantasyPoints?: number | null;
  [stat: string]: unknown;
}

export interface StatColumn {
  header: string;
  key: string;
}

const RUSH: StatColumn[] = [
  { header: "Carries", key: "rushingCarries" },
  { header: "Rush Yds", key: "rushingYards" },
  { header: "Rush TD", key: "rushingTouchdowns" },
];

export const POSITIONS = ["QB", "RB", "WR", "TE", "FLX", "K", "DST"] as const;
export type PositionFilter = (typeof POSITIONS)[number];

export const STAT_COLUMNS: Record<PositionFilter, StatColumn[]> = {
  QB: [
    { header: "Cmp", key: "passingCompletions" },
    { header: "Att", key: "passingAttempts" },
    { header: "Pass Yds", key: "passingYards" },
    { header: "Pass TD", key: "passingTouchdowns" },
    { header: "INT", key: "passingInterceptions" },
    { header: "Rush Yds", key: "rushingYards" },
    { header: "Rush TD", key: "rushingTouchdowns" },
  ],
  RB: [
    ...RUSH,
    { header: "Rec", key: "receivingReceptions" },
    { header: "Rec Yds", key: "receivingYards" },
    { header: "Rec TD", key: "receivingTouchdowns" },
    { header: "Fum Lost", key: "carryingFumblesLost" },
  ],
  WR: [
    { header: "Rec", key: "receivingReceptions" },
    { header: "Rec Yds", key: "receivingYards" },
    { header: "Rec TD", key: "receivingTouchdowns" },
    ...RUSH,
    { header: "Fum Lost", key: "carryingFumblesLost" },
  ],
  TE: [
    { header: "Rec", key: "receivingReceptions" },
    { header: "Rec Yds", key: "receivingYards" },
    { header: "Rec TD", key: "receivingTouchdowns" },
    { header: "Fum Lost", key: "carryingFumblesLost" },
  ],
  FLX: [
    { header: "Rec", key: "receivingReceptions" },
    { header: "Rec Yds", key: "receivingYards" },
    { header: "Rec TD", key: "receivingTouchdowns" },
    ...RUSH,
    { header: "Fum Lost", key: "carryingFumblesLost" },
  ],
  K: [
    { header: "FG Made", key: "kickingFgMade" },
    { header: "FG Miss", key: "kickingFgMissed" },
    { header: "XP Made", key: "kickingXpMade" },
    { header: "XP Miss", key: "kickingXpMissed" },
  ],
  DST: [
    { header: "Pts Allowed", key: "dstPointsAllowed" },
    { header: "Yds Allowed", key: "dstYardsAllowed" },
    { header: "Sacks", key: "dstSacks" },
    { header: "INT", key: "dstInterceptions" },
    { header: "Def TD", key: "dstDefTd" },
  ],
};

export const teamOf = (row: PlayerSeasonStats): string =>
  row.player?.teamAbv || row.player?.team?.teamAbv || "FA";

export const statValue = (row: PlayerSeasonStats, key: string): number => {
  const value = row[key];
  return typeof value === "number" ? value : 0;
};

export function filterPlayers(
  rows: PlayerSeasonStats[],
  position: PositionFilter,
  search: string,
): PlayerSeasonStats[] {
  const needle = search.trim().toLowerCase();
  return rows.filter((row) => {
    const pos = row.player?.position ?? "";
    const matchesPosition =
      position === "FLX" ? ["RB", "WR", "TE"].includes(pos) : pos === position;
    const matchesSearch = !needle || (row.player?.name ?? "").toLowerCase().includes(needle);
    return matchesPosition && matchesSearch;
  });
}

export type SortKey = "fantasyPoints" | "name" | string;

/** Highest fantasy points first by default; stat keys sort high to low, names A to Z. */
export function sortPlayers(rows: PlayerSeasonStats[], sortKey: SortKey): PlayerSeasonStats[] {
  const byName = (a: PlayerSeasonStats, b: PlayerSeasonStats) =>
    (a.player?.name ?? "").localeCompare(b.player?.name ?? "");
  const sorted = [...rows];
  if (sortKey === "name") return sorted.sort(byName);
  const value = (row: PlayerSeasonStats) =>
    sortKey === "fantasyPoints"
      ? (row.fantasyPoints ?? Number.NEGATIVE_INFINITY)
      : statValue(row, sortKey);
  return sorted.sort((a, b) => value(b) - value(a) || byName(a, b));
}

export const formatPoints = (points: number | null | undefined): string =>
  points === null || points === undefined ? "—" : points.toFixed(1);
