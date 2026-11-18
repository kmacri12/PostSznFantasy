import type { DraftState, SeasonRecap, Standings, StandingsRow } from "../../api/types";
import { formatPoints, ROUNDS } from "../league/standingsView";

export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1350;

export interface CardRow {
  rank: number;
  label: string;
  detail: string;
  value: string;
}

export interface DraftColumn {
  title: string;
  lines: { text: string; position: string | null }[];
}

/** What a card says, with no layout: display and team names only, never an email. */
export interface ShareCard {
  kind: "champion" | "round" | "draft";
  leagueName: string;
  eyebrow: string;
  headline: string;
  subhead: string;
  rows: CardRow[];
  columns: DraftColumn[];
  fileName: string;
}

const slug = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "league";

const topRows = (teams: StandingsRow[], score: (team: StandingsRow) => number): CardRow[] => {
  const ranked = [...teams].sort((a, b) => score(b) - score(a));
  return ranked.slice(0, 3).map((team) => ({
    // Equal scores share the better rank.
    rank: ranked.findIndex((other) => score(other) === score(team)) + 1,
    label: team.teamName,
    detail: team.owner ?? "",
    value: `${formatPoints(score(team))} pts`,
  }));
};

export const championCard = (leagueName: string, recap: SeasonRecap): ShareCard | null => {
  if (recap.champions.length === 0) return null;
  const rows = recap.standings.teams
    .filter((team): team is StandingsRow & { rank: number } => team.rank !== null)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 3)
    .map((team) => ({
      rank: team.rank,
      label: team.teamName,
      detail: team.owner ?? "",
      value: `${formatPoints(team.total)} pts`,
    }));
  const tied = recap.champions.length > 1;
  return {
    kind: "champion",
    leagueName,
    eyebrow: `${recap.year} ${tied ? "co-champions" : "champion"}`,
    headline: recap.champions.map((c) => c.teamName).join(" and "),
    subhead: recap.champions.map((c) => c.owner).join(" and "),
    rows,
    columns: [],
    fileName: `${slug(leagueName)}-${recap.year}-champion.png`,
  };
};

/** The round the standings describe is over: no live or still-to-play starter, a game is final. */
export const roundIsComplete = (standings: Standings): boolean =>
  standings.phase === "live" &&
  standings.gamesInProgress === 0 &&
  standings.gamesFinal > 0 &&
  !standings.teams.some((team) => team.progress.live + team.progress.toPlay > 0);

export const roundCard = (
  leagueName: string,
  year: number,
  standings: Standings,
): ShareCard | null => {
  if (!roundIsComplete(standings)) return null;
  const round = ROUNDS[standings.round - 1];
  if (!round) return null;
  const rows = topRows(standings.teams, (team) => team[round.key]);
  const leader = rows[0];
  if (!leader) return null;
  return {
    kind: "round",
    leagueName,
    eyebrow: `${year} ${round.label} round`,
    headline: leader.label,
    subhead: `Top score of the round: ${leader.value}`,
    rows,
    columns: [],
    fileName: `${slug(leagueName)}-${year}-${slug(round.label)}.png`,
  };
};

export const draftCard = (
  leagueName: string,
  year: number,
  draft: DraftState,
): ShareCard | null => {
  if (draft.status !== "completed" || draft.picks.length === 0) return null;
  const columns = draft.order.map((slot) => ({
    title: slot.teamName,
    lines: draft.picks
      .filter((pick) => pick.teamId === slot.teamId)
      .sort((a, b) => a.numberPickOverall - b.numberPickOverall)
      .map((pick) => ({ text: pick.playerName ?? "Unknown player", position: pick.position })),
  }));
  return {
    kind: "draft",
    leagueName,
    eyebrow: `${year} draft recap`,
    headline: leagueName,
    subhead: `${draft.picks.length} picks, ${draft.rounds} rounds`,
    rows: [],
    columns,
    fileName: `${slug(leagueName)}-${year}-draft.png`,
  };
};

/** Three teams across for a small league, four above six. */
export const draftGridShape = (teams: number): { cols: number; rows: number } => {
  const cols = teams <= 6 ? 3 : 4;
  return { cols, rows: Math.max(1, Math.ceil(teams / cols)) };
};
