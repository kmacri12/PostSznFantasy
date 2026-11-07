import type { LeagueByUser } from "../../api/types";
import { leaguePath, seasonPaths } from "../../routes";

export type LeagueTabLabel = "League" | "Team" | "Draft" | "Feed" | "More";

export interface LeagueTab {
  label: LeagueTabLabel;
  to: string;
  /** Pathname test so each URL lights exactly one tab, whichever season it shows. */
  matches: (pathname: string) => boolean;
  /** Show the new-activity dot. */
  dot: boolean;
}

/** Tabs open the league's latest season. */
export function leagueTabs(league: LeagueByUser): LeagueTab[] {
  const paths = seasonPaths(league.id, league.season, true);
  const base = leaguePath(league.id);
  /** The page under the league, whichever season it shows; null outside this league. */
  const page = (pathname: string) => {
    if (pathname !== base && !pathname.startsWith(`${base}/`)) return null;
    return pathname
      .slice(base.length)
      .replace(/^\/seasons\/\d+/, "")
      .replace(/\/$/, "");
  };
  return [
    {
      label: "League",
      to: paths.home,
      matches: (p) => page(p) === "" || page(p) === "/settings",
      dot: false,
    },
    {
      label: "Team",
      to: league.userTeamId === null ? paths.home : paths.team(league.userTeamId),
      matches: (p) => page(p)?.startsWith("/teams/") ?? false,
      dot: false,
    },
    {
      label: "Draft",
      to: paths.draft,
      matches: (p) => page(p)?.startsWith("/draft") ?? false,
      dot: false,
    },
    {
      label: "Feed",
      to: paths.feed,
      matches: (p) => page(p) === "/feed",
      dot: league.hasNewActivity,
    },
    {
      label: "More",
      to: paths.more,
      matches: (p) => page(p) === "/more",
      dot: false,
    },
  ];
}

export function activeTabIndex(tabs: LeagueTab[], pathname: string): number {
  return tabs.findIndex((tab) => tab.matches(pathname));
}
