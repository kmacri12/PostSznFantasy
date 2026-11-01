import type { LeagueByUser } from "../../api/types";
import { leaguePath, seasonPaths } from "../../routes";

export interface LeagueTab {
  label: "League" | "Team" | "Draft" | "Players";
  to: string;
  /** Pathname test so each URL lights exactly one tab, whichever season it shows. */
  matches: (pathname: string) => boolean;
  /** Show the new-activity dot. */
  dot: boolean;
}

/** Tabs open the league's latest season. */
export function leagueTabs(league: LeagueByUser): LeagueTab[] {
  const paths = seasonPaths(league.id, league.season);
  const season = new RegExp(`^${leaguePath(league.id)}/seasons/\\d+`);
  const inSeason = (pathname: string, rest: RegExp) => season.test(pathname) && rest.test(pathname);
  return [
    {
      label: "League",
      to: paths.home,
      matches: (p) => inSeason(p, /\/seasons\/\d+\/?$/) || p === leaguePath(league.id),
      dot: league.hasNewActivity,
    },
    {
      label: "Team",
      to: league.userTeamId === null ? paths.home : paths.team(league.userTeamId),
      matches: (p) => inSeason(p, /\/teams\//),
      dot: false,
    },
    { label: "Draft", to: paths.draft, matches: (p) => inSeason(p, /\/draft$/), dot: false },
    {
      label: "Players",
      to: paths.players,
      matches: (p) => inSeason(p, /\/players$/) || p === "/players",
      dot: false,
    },
  ];
}

export function activeTabIndex(tabs: LeagueTab[], pathname: string): number {
  return tabs.findIndex((tab) => tab.matches(pathname));
}
