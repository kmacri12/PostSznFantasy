import { tokens } from "../../theme";
import { PLAYER_STATUSES, type PlayerStatus } from "./lineupView";

export const STATUS_COLOR: Record<PlayerStatus, string> = {
  advanced: tokens.green,
  live: tokens.live,
  toPlay: tokens.inputBorder,
  eliminated: tokens.red,
};

export const STATUS_LABEL: Record<PlayerStatus, string> = {
  advanced: "advanced",
  live: "live",
  toPlay: "to play",
  eliminated: "eliminated",
};

export const playersLeftText = (left: number): string =>
  `${left} ${left === 1 ? "player" : "players"} left`;

/** "3 advanced, 1 live": the statuses that have players, for a spoken label. */
export const statusSummary = (counts: Record<PlayerStatus, number>): string =>
  PLAYER_STATUSES.filter((status) => counts[status] > 0)
    .map((status) => `${counts[status]} ${STATUS_LABEL[status]}`)
    .join(", ");

/** Everyone not eliminated. */
export const rosterLeft = (counts: Record<PlayerStatus, number>): number =>
  PLAYER_STATUSES.reduce((sum, status) => sum + counts[status], 0) - counts.eliminated;
