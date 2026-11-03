import { createContext, useContext } from "react";
import type { SeasonOverview } from "../api/types";
import { type SeasonPaths, seasonPaths } from "../routes";

export interface SeasonContextValue {
  leagueId: number;
  year: number;
  seasonId: number;
  /** The season's home data, including the caller's `canEdit` / `canCommission` in it. */
  season: SeasonOverview;
  paths: SeasonPaths;
}

export const SeasonContext = createContext<SeasonContextValue | null>(null);

export const buildSeasonContext = (
  season: SeasonOverview,
  current: boolean,
): SeasonContextValue => ({
  leagueId: season.leagueId,
  year: season.year,
  seasonId: season.id,
  season,
  paths: seasonPaths(season.leagueId, season.year, current),
});

/** The season the route under `SeasonLayout` shows. */
export const useSeasonContext = (): SeasonContextValue => {
  const value = useContext(SeasonContext);
  if (value === null) throw new Error("useSeasonContext needs a SeasonLayout above it");
  return value;
};

/** The route's season when the page sits under a season; null on pages that do not. */
export const useOptionalSeasonContext = (): SeasonContextValue | null => useContext(SeasonContext);
