import type { StandingsRow } from "../../api/types";

/** "T2" when another team shares the rank, so a shared title is never read as a win. */
export const rankLabel = (rows: StandingsRow[], index: number): string => {
  const rank = rows[index]?.rank;
  if (rank == null) return "–";
  const shared = rows.some((row, other) => other !== index && row.rank === rank);
  return shared ? `T${rank}` : String(rank);
};

/**
 * Why this row sits where it does among teams with the same total, from its own side:
 * the team above carries the reason, so the team below words it as "behind".
 */
export const tieNote = (rows: StandingsRow[], index: number): string | null => {
  const own = rows[index]?.tieReason;
  if (own) return own.message;
  const above = index > 0 ? rows[index - 1] : undefined;
  if (above?.tieReason) {
    return `Behind ${above.teamName} on the tiebreaker: ${above.tieReason.detail}`;
  }
  return null;
};

/** An open team slot before the draft. */
export const isOpenSpot = (row: StandingsRow): boolean => row.owner === null;

/** Up to two decimals, at least one: 84.2, 7.0, 12.65. */
export const formatPoints = (value: number): string => value.toFixed(2).replace(/0$/, "");

export const ROUNDS = [
  { key: "wildCard", label: "Wild Card", short: "Wild Card" },
  { key: "divisional", label: "Divisional", short: "Divisional" },
  { key: "confChamp", label: "Conf. champ", short: "Conf." },
  { key: "superBowl", label: "Super Bowl", short: "Super Bowl" },
] as const;

/** One-line detail under a team name: owner, commissioner mark and, while live, players left. */
export const rowDetail = (row: StandingsRow, live: boolean): string =>
  [
    row.owner ?? "Waiting for a player",
    row.isCommissioner ? "commissioner" : null,
    live ? `${row.playersLeft} left` : null,
    live ? `${row.progress.live} live` : null,
  ]
    .filter(Boolean)
    .join(" · ");
