import type { DraftState } from "../../api/types";
import { formatInViewerZone } from "../../utils/timeZone";
import { formatCountdown } from "../league/countdown";
import { picksAwayLabel } from "./pickOrder";

export const formatClock = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  const mmss = `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
  return hours > 0 ? `${hours}:${mmss}` : mmss;
};

/** "Saturday 7:00 PM EST": the countdown under it says how far off that is. */
const formatBarTime = (iso: string): string =>
  formatInViewerZone(iso, { weekday: "long", hour: "numeric", minute: "2-digit" });

export interface ClockText {
  title: string;
  subtitle: string;
  /** The pick clock, or the time to the start; null when neither runs. */
  timer: string | null;
  /** My pick: the bar takes the accent fill. */
  myTurn: boolean;
  /** "On deck" or "3 picks away" until my next pick; null on my turn or with none left. */
  picksAway: string | null;
}

/** Round and pick of the pick on the clock, "Round 2, pick 4". */
export const roundAndPick = (state: DraftState): string | null => {
  const overall = state.currentPickOverall;
  const teams = state.order.length;
  if (overall === null || teams === 0) return null;
  const round = Math.ceil(overall / teams);
  return `Round ${round}, pick ${overall - (round - 1) * teams}`;
};

/** What the sticky draft bar says in every draft status; everything derives from server state. */
export function clockText(
  state: DraftState,
  myTeamId: number | null,
  secondsLeft: number | null,
  secondsToStart: number | null,
): ClockText {
  const teamName = state.order.find((slot) => slot.teamId === state.onTheClockTeamId)?.teamName;
  const myTurn = myTeamId !== null && state.onTheClockTeamId === myTeamId;
  const place = roundAndPick(state) ?? "Finishing up";

  switch (state.status) {
    case "in_progress":
      return {
        title: myTurn ? "You're on the clock" : `${teamName ?? "…"} on the clock`,
        subtitle: place,
        picksAway: picksAwayLabel(state, myTeamId),
        timer: secondsLeft === null ? null : formatClock(secondsLeft),
        myTurn,
      };
    case "paused":
      return {
        title: "Draft paused",
        subtitle: `${place} · ${myTurn ? "you're" : `${teamName ?? "…"} is`} on the clock`,
        timer: secondsLeft === null ? null : formatClock(secondsLeft),
        myTurn: false,
        picksAway: picksAwayLabel(state, myTeamId),
      };
    case "completed":
      return {
        title: "Draft complete",
        subtitle: `${state.totalPicks} picks`,
        timer: null,
        myTurn: false,
        picksAway: null,
      };
    default:
      if (!state.startTime) {
        return {
          title: "Draft not scheduled yet",
          subtitle: "No clock yet",
          timer: null,
          myTurn: false,
          picksAway: null,
        };
      }
      if (secondsToStart !== null && secondsToStart <= 0) {
        return {
          title: "Draft time has passed",
          subtitle: "Waiting for the commissioner to start it",
          timer: null,
          myTurn: false,
          picksAway: null,
        };
      }
      return {
        title: `Draft scheduled for ${formatBarTime(state.startTime)}`,
        subtitle: secondsToStart === null ? "" : `${formatCountdown(secondsToStart * 1000)} to go`,
        timer: null,
        myTurn: false,
        picksAway: null,
      };
  }
}
