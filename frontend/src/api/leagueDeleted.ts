import type { QueryClient, QueryKey } from "@tanstack/react-query";

/** What a member may see about a league a commissioner deleted: the API's `leagueDeleted` 404. */
export interface LeagueDeleted {
  leagueName: string;
  deletedAt: string;
}

export const leagueDeletedInfo = (error: unknown): LeagueDeleted | null => {
  const response = (
    error as {
      response?: {
        status?: number;
        data?: { code?: unknown; leagueName?: unknown; deletedAt?: unknown };
      };
    } | null
  )?.response;
  if (response?.status !== 404 || response.data?.code !== "leagueDeleted") return null;
  return {
    leagueName: String(response.data.leagueName ?? ""),
    deletedAt: String(response.data.deletedAt ?? ""),
  };
};

const LEAGUE_SEASONS = "league-seasons";

/**
 * Every league page sits under a layout that loads the league's seasons, so refetching that one
 * query is how any guarded call that finds the league deleted swaps the page for the deleted page.
 * The seasons query itself is skipped: refetching it from its own failure would loop.
 */
export const recheckLeagueOnDeleted = (
  queryClient: QueryClient,
  error: unknown,
  failedKey?: QueryKey,
) => {
  if (!leagueDeletedInfo(error) || failedKey?.[0] === LEAGUE_SEASONS) return;
  void queryClient.invalidateQueries({ queryKey: [LEAGUE_SEASONS] });
};
