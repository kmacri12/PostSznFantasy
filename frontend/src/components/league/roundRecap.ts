import type { RoundHighlight } from "../../api/types";
import { ROUND_LABELS } from "../team/lineup";

/** The small heading above each kind of highlight. */
export const HIGHLIGHT_LABELS: Record<string, string> = {
  top_team: "Team of the week",
  low_team: "Toughest week",
  top_starter: "Top starter",
  top_bench: "Left on the bench",
  climber: "Moving up",
  faller: "Sliding",
  most_lost: "Hit hard",
  none_lost: "Untouched",
};

export const highlightLabel = (highlight: RoundHighlight): string =>
  HIGHLIGHT_LABELS[highlight.kind] ?? "Notable";

export const recapTitle = (round: number): string =>
  `${ROUND_LABELS[round] ?? `Round ${round}`} recap`;

export type HighlightTone = "gold" | "accent" | "green" | "red" | "warning";

/** What each kind looks like: an emoji badge and the colour of its badge and number. */
export const HIGHLIGHT_STYLE: Record<string, { emoji: string; tone: HighlightTone }> = {
  top_team: { emoji: "🏆", tone: "gold" },
  low_team: { emoji: "🥶", tone: "accent" },
  top_starter: { emoji: "⭐", tone: "gold" },
  top_bench: { emoji: "🪑", tone: "warning" },
  climber: { emoji: "📈", tone: "green" },
  faller: { emoji: "📉", tone: "red" },
  most_lost: { emoji: "💥", tone: "red" },
  none_lost: { emoji: "🛡️", tone: "green" },
};

export const highlightStyle = (highlight: RoundHighlight): { emoji: string; tone: HighlightTone } =>
  HIGHLIGHT_STYLE[highlight.kind] ?? { emoji: "✨", tone: "accent" };
