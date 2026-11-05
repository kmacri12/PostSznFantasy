import type { DraftState } from "../../api/types";
import { formatCountdown } from "../league/countdown";

export const formatClock = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  const mmss = `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
  return hours > 0 ? `${hours}:${mmss}` : mmss;
};

/** "Saturday 7:00 pm": the countdown under it says how far off that is. */
const formatBarTime = (iso: string): string =>
  new Date(iso).toLocaleString(undefined, {
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
  });

export interface ClockText {
  title: string;
  subtitle: string;
  /** The pick clock, or the time to the start; null when neither runs. */
  timer: string | null;
  /** My pick: the bar turns green. */
  myTurn: boolean;
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
  const onDeck = myTeamId !== null && state.onDeckTeamId === myTeamId;
  const place = roundAndPick(state) ?? "Finishing up";

  switch (state.status) {
    case "in_progress":
      return {
        title: myTurn ? "You're on the clock" : `${teamName ?? "…"} on the clock`,
        subtitle: !myTurn && onDeck ? `${place} · you're on deck` : place,
        timer: secondsLeft === null ? null : formatClock(secondsLeft),
        myTurn,
      };
    case "paused":
      return {
        title: "Draft paused",
        subtitle: `${place} · ${myTurn ? "you're" : `${teamName ?? "…"} is`} on the clock`,
        timer: secondsLeft === null ? null : formatClock(secondsLeft),
        myTurn: false,
      };
    case "completed":
      return {
        title: "Draft complete",
        subtitle: `${state.totalPicks} picks`,
        timer: null,
        myTurn: false,
      };
    default:
      if (!state.startTime) {
        return {
          title: "Draft not scheduled yet",
          subtitle: "No clock yet",
          timer: null,
          myTurn: false,
        };
      }
      return {
        title: `Draft scheduled for ${formatBarTime(state.startTime)}`,
        subtitle: secondsToStart === null ? "" : `${formatCountdown(secondsToStart * 1000)} to go`,
        timer: null,
        myTurn: false,
      };
  }
}
