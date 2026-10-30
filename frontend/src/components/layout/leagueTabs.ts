import type { LeagueByUser } from "../../api/types";

export interface LeagueTab {
  label: "League" | "Team" | "Draft" | "Players";
  to: string;
  /** Pathname test so each URL lights exactly one tab. */
  matches: (pathname: string) => boolean;
  /** Show the new-activity dot. */
  dot: boolean;
}

export function leagueTabs(league: LeagueByUser): LeagueTab[] {
  const base = `/league/${league.id}`;
  return [
    { label: "League", to: base, matches: (p) => p === base, dot: league.hasNewActivity },
    {
      label: "Team",
      to: league.userTeamId === null ? base : `/team/${league.userTeamId}`,
      matches: (p) => p.startsWith("/team/"),
      dot: false,
    },
    { label: "Draft", to: `${base}/draft`, matches: (p) => p === `${base}/draft`, dot: false },
    {
      label: "Players",
      to: `/players?leagueId=${league.id}`,
      matches: (p) => p.startsWith("/players"),
      dot: false,
    },
  ];
}

export function activeTabIndex(tabs: LeagueTab[], pathname: string): number {
  return tabs.findIndex((tab) => tab.matches(pathname));
}
