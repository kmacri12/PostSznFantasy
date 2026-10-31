import type { LeagueByUser } from "../../api/types";

export interface SeasonGroup {
  season: number;
  leagues: LeagueByUser[];
}

/** Newest season first; leagues keep the order the API gave them within a season. */
export const groupBySeason = (leagues: LeagueByUser[]): SeasonGroup[] => {
  const bySeason = new Map<number, LeagueByUser[]>();
  for (const league of leagues)
    bySeason.set(league.season, [...(bySeason.get(league.season) ?? []), league]);
  return [...bySeason]
    .sort(([a], [b]) => b - a)
    .map(([season, grouped]) => ({ season, leagues: grouped }));
};
