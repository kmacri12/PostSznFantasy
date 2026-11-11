import type { InboxItem } from "../../api/types";
import { leaguePath, seasonPaths } from "../../routes";
import { ROUND_LABELS } from "../team/lineup";

export interface InboxLine {
  title: string;
  body: string;
  /** Where tapping the entry goes: the same page its push opens. */
  path: string;
}

/** Wording and link for one inbox entry; an unknown kind (a newer API) still links to its league. */
export const describeNotification = (item: InboxItem): InboxLine => {
  // Entries are at most 30 days old, so they belong to the league's current season, the one
  // whose addresses carry no year (the year argument is unused for it).
  const paths = seasonPaths(item.leagueId, "", true);
  const league = item.leagueName;
  const team = item.payload.teamId;
  const round = item.payload.round ? (ROUND_LABELS[item.payload.round] ?? "") : "";
  switch (item.kind) {
    case "draft_turn":
      return {
        title: "You're on the clock",
        body: `Your pick is up in ${league}.`,
        path: paths.draft,
      };
    case "draft_lobby":
      return { title: "The draft lobby is open", body: league, path: paths.draft };
    case "draft_started":
      return { title: "The draft has started", body: league, path: paths.draft };
    case "draft_scheduled":
      return {
        title: "The draft time is set",
        body: `${league}. Open the draft page to see it in your time zone.`,
        path: paths.draft,
      };
    case "draft_soon":
      return {
        title: "Your draft is scheduled soon",
        body: `${league}. Your commissioner starts it.`,
        path: paths.draft,
      };
    case "lineup_lock":
      return {
        title: "Lineup locks in about an hour",
        body: `You have an empty ${round ? `${round} ` : ""}starter slot in ${league}.`,
        path: team ? paths.team(team) : paths.home,
      };
    case "lineup_changed":
      return {
        title: "A commissioner changed your lineup",
        body: `Your ${round ? `${round} ` : ""}lineup in ${league}.`,
        path: team ? paths.team(team) : paths.home,
      };
    case "starter_out":
      return {
        title: "A starter is hurt",
        body: `Check your ${round ? `${round} ` : ""}lineup in ${league}.`,
        path: team ? paths.team(team) : paths.home,
      };
    case "player_scored":
      return {
        title: "Touchdown!",
        body: `One of your starters scored in ${league}.`,
        path: team ? paths.team(team) : paths.home,
      };
    case "round_result":
      return {
        title: `${round ? `${round} is` : "The round is"} final`,
        body: `See how you moved in ${league}.`,
        path: paths.home,
      };
    case "team_eliminated":
      return {
        title: "Your last player's team lost",
        body: `You're out of players in ${league}.`,
        path: paths.home,
      };
    case "mention":
      return {
        title: "You were mentioned",
        body: `Someone tagged you in the ${league} chat.`,
        path: paths.feed,
      };
    default:
      return {
        title: league,
        body: "Something new in your league.",
        path: leaguePath(item.leagueId),
      };
  }
};
