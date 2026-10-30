import type { StandingsRow, StarterProgress } from "../../api/types";

export const ROUND_NAMES = ["Wild Card", "Divisional", "Conference Championship", "Super Bowl"];

/** "T2" when another team shares the rank, so a shared title is never read as a win. */
export const rankLabel = (rows: StandingsRow[], index: number): string => {
  const rank = rows[index]?.rank;
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

export type ProgressKey = keyof StarterProgress;

/** Each count has an icon and a word as well as a colour, so none relies on colour alone. */
export const PROGRESS_ITEMS: { key: ProgressKey; label: string; hint: string }[] = [
  { key: "finished", label: "Finished", hint: "Game over" },
  { key: "live", label: "Live", hint: "Game in progress" },
  { key: "toPlay", label: "To play", hint: "Not kicked off yet" },
  { key: "notPlaying", label: "Not playing", hint: "Empty slot, eliminated or on a bye" },
];
