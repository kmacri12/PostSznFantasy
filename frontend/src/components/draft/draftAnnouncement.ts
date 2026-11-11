import type { DraftState } from "../../api/types";
import { clockText } from "./clockText";

/** Seconds left on my pick at which a screen reader hears a warning, latest first. */
const WARNINGS = [10, 30];

export interface AnnouncedDraft {
  picks: number;
  lastPick: string | null;
  title: string;
  warning: string | null;
}

/** What the screen reader announcement is made of; it never contains the ticking clock itself. */
export const announcedDraft = (
  state: DraftState,
  myTeamId: number | null,
  secondsLeft: number | null,
): AnnouncedDraft => {
  const text = clockText(state, myTeamId, secondsLeft, null);
  const pick = state.picks.at(-1);
  const team = pick && state.order.find((slot) => slot.teamId === pick.teamId)?.teamName;
  const limit =
    text.myTurn && secondsLeft !== null && secondsLeft > 0
      ? WARNINGS.find((seconds) => secondsLeft <= seconds)
      : undefined;
  return {
    picks: state.picks.length,
    lastPick: pick
      ? `Pick ${pick.numberPickOverall}: ${team ?? "A team"} took ${pick.playerName ?? "a player"}`
      : null,
    title: text.title,
    warning: limit === undefined ? null : `Under ${limit} seconds to make your pick`,
  };
};

/**
 * The sentence to announce when the draft moves from `before` to `after`, or null when nothing a
 * listener needs changed. A pick, a new team on the clock and a 30 / 10 second warning on my own
 * pick each speak once; the countdown never does, or it would talk over everything every second.
 */
export const draftAnnouncement = (
  before: AnnouncedDraft | null,
  after: AnnouncedDraft,
): string | null => {
  if (before === null) return null;
  const parts: string[] = [];
  if (after.picks > before.picks && after.lastPick) parts.push(after.lastPick);
  if (after.title !== before.title) parts.push(after.title);
  if (after.warning && after.warning !== before.warning) parts.push(after.warning);
  return parts.length > 0 ? `${parts.join(". ")}.` : null;
};
