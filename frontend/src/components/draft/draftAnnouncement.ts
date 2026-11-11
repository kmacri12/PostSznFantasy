import type { DraftState } from "../../api/types";

/** Seconds left on my pick at which a screen reader hears a warning, latest first. */
const WARNINGS = [10, 30];

export interface AnnouncedDraft {
  picks: number;
  lastPick: string | null;
  turn: string | null;
  warning: string | null;
}

/**
 * What the screen reader announcement is made of; never the ticking clock itself. The wording
 * differs from the clock bar's on purpose, so a text search finds the visible line only once.
 */
export const announcedDraft = (
  state: DraftState,
  myTeamId: number | null,
  secondsLeft: number | null,
): AnnouncedDraft => {
  const teamName = (teamId: number | null) =>
    state.order.find((slot) => slot.teamId === teamId)?.teamName ?? "A team";
  const pick = state.picks.at(-1);
  const myTurn =
    state.status === "in_progress" && myTeamId !== null && state.onTheClockTeamId === myTeamId;
  let turn: string | null = null;
  if (state.status === "paused") turn = "The draft is on hold";
  else if (myTurn) turn = "You are on the clock";
  else if (state.status === "in_progress" && state.onTheClockTeamId !== null)
    turn = `${teamName(state.onTheClockTeamId)} is on the clock`;
  const limit =
    myTurn && secondsLeft !== null && secondsLeft > 0
      ? WARNINGS.find((seconds) => secondsLeft <= seconds)
      : undefined;
  return {
    picks: state.picks.length,
    lastPick: pick
      ? `Pick ${pick.numberPickOverall}: ${teamName(pick.teamId)} took ${pick.playerName ?? "a player"}`
      : null,
    turn,
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
  if (after.turn && (after.turn !== before.turn || after.picks !== before.picks))
    parts.push(after.turn);
  if (after.warning && after.warning !== before.warning) parts.push(after.warning);
  return parts.length > 0 ? `${parts.join(". ")}.` : null;
};
