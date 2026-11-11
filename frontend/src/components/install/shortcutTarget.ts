import type { LeagueByUser } from "../../api/types";
import { seasonPaths } from "../../routes";

export const SHORTCUTS = ["draft", "team", "feed"] as const;
export type Shortcut = (typeof SHORTCUTS)[number];

export const parseShortcut = (search: string): Shortcut | null => {
  const value = new URLSearchParams(search).get("shortcut");
  return SHORTCUTS.find((item) => item === value) ?? null;
};

type ShortcutLeague = Pick<LeagueByUser, "id" | "season" | "finished" | "userTeamId">;

/**
 * Where a Home Screen shortcut (the manifest's `/?shortcut=draft|team|feed`) goes: the member's
 * most recent league that is still playing, else the first one. Null when they have no league.
 */
export const shortcutTarget = (shortcut: Shortcut, leagues: ShortcutLeague[]): string | null => {
  const league = leagues.find((item) => !item.finished) ?? leagues[0];
  if (!league) return null;
  const paths = seasonPaths(league.id, league.season, true);
  if (shortcut === "team") return league.userTeamId ? paths.team(league.userTeamId) : paths.home;
  return paths[shortcut];
};
