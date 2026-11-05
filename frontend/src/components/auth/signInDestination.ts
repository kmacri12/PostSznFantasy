import type { LeagueByUser } from "../../api/types";
import { leaguePath } from "../../routes";

/**
 * Where someone lands right after signing in with no explicit destination: straight into
 * their only league, otherwise the leagues page (cards, or Create / Join when there are none).
 * The logo always opens the leagues page; only a fresh sign-in redirects.
 */
export const signInDestination = (leagues: Pick<LeagueByUser, "id">[]): string => {
  const [only] = leagues;
  return leagues.length === 1 && only ? leaguePath(only.id) : "/";
};
