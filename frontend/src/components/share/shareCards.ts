import type {
  DraftState,
  RoundHighlight,
  SeasonRecap,
  StandingsRow,
  TeamScore,
} from "../../api/types";
import { highlightLabel, highlightStyle, recapTitle } from "../league/roundRecap";
import { formatPoints } from "../league/standingsView";

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

export interface CardHighlight {
  label: string;
  text: string;
  emoji: string;
  tone: "gold" | "accent" | "green" | "red" | "warning";
  stat: string | null;
}

/** What a card says, with no layout: display and team names only, never an email. */
export interface ShareCard {
  kind: "champion" | "draft" | "recap";
  leagueName: string;
  eyebrow: string;
  headline: string;
  subhead: string;
  rows: CardRow[];
  columns: DraftColumn[];
  /** The weekly recap card only. */
  highlights?: CardHighlight[];
  /** The weekly recap card only: every team's points for the week, best first. */
  scores?: { rank: number; label: string; value: string }[];
  fileName: string;
}

const slug = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "league";

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
    eyebrow: `${year} draft board`,
    headline: leagueName,
    subhead: `${draft.picks.length} picks, ${draft.rounds} rounds`,
    rows: [],
    columns,
    fileName: `${slug(leagueName)}-${year}-draft.png`,
  };
};

/** The weekly recap as one portrait picture: the league, every highlight, then the scores. */
export const recapCard = (
  leagueName: string,
  year: number,
  round: number,
  highlights: RoundHighlight[],
  teamScores: TeamScore[] = [],
): ShareCard | null =>
  highlights.length === 0
    ? null
    : {
        kind: "recap",
        leagueName,
        eyebrow: recapTitle(round),
        headline: leagueName,
        subhead: "",
        rows: [],
        columns: [],
        highlights: highlights.map((h) => ({
          label: highlightLabel(h),
          text: h.text,
          ...highlightStyle(h),
          stat: h.stat ?? null,
        })),
        scores: teamScores.map((team, _, all) => ({
          // Equal scores share the better rank.
          rank: all.findIndex((other) => other.points === team.points) + 1,
          label: team.teamName,
          value: formatPoints(team.points),
        })),
        fileName: `${slug(leagueName)}-${year}-${slug(recapTitle(round))}.png`,
      };

export const RECAP_TOP = 276;
export const RECAP_ITEM = 108;
export const RECAP_SCORES_HEAD = 76;
export const RECAP_SCORE_ROW = 46;
export const RECAP_FOOTER = 140;

export const BOARD_MARGIN = 40;
export const BOARD_ROUND_COL = 56;
export const BOARD_TEAM_COL = 168;
export const BOARD_HEADER = 215;
export const BOARD_TEAM_ROW = 80;
export const BOARD_CELL = 76;
export const BOARD_FOOTER = 90;

/** Picture size: the podium cards are a fixed portrait; the board grows with teams and rounds. */
export const cardSize = (card: ShareCard): { width: number; height: number } => {
  if (card.kind === "recap") {
    const scores = card.scores?.length ?? 0;
    const height =
      RECAP_TOP +
      (card.highlights?.length ?? 0) * RECAP_ITEM +
      (scores > 0 ? RECAP_SCORES_HEAD + Math.ceil(scores / 2) * RECAP_SCORE_ROW : 0) +
      RECAP_FOOTER;
    return { width: CARD_WIDTH, height: Math.max(CARD_HEIGHT, height) };
  }
  if (card.kind !== "draft") return { width: CARD_WIDTH, height: CARD_HEIGHT };
  const rounds = Math.max(1, ...card.columns.map((column) => column.lines.length));
  return {
    width: BOARD_MARGIN * 2 + BOARD_ROUND_COL + card.columns.length * BOARD_TEAM_COL,
    height: BOARD_HEADER + BOARD_TEAM_ROW + rounds * BOARD_CELL + BOARD_FOOTER,
  };
};
