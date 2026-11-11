import type { RoundLineup } from "../../api/types";
import { partsInViewerZone } from "../../utils/timeZone";

export const BENCH_SLOT = "BENCH";

export const ROUND_LABELS: Record<number, string> = {
  1: "Wild Card",
  2: "Divisional",
  3: "Conference Championship",
  4: "Super Bowl",
};

export interface Move {
  playerId: number;
  /** null takes the player out of the lineup. */
  slotIndex: number | null;
}

/** "Sun 6:30 pm EST": the day and time of a game, never the word "kickoff". */
export const formatKickoff = (iso: string): string => {
  const parts = partsInViewerZone(iso, { weekday: "short", hour: "numeric", minute: "2-digit" });
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? "";
  const clock = `${part("hour")}:${part("minute")}`;
  const period = part("dayPeriod").toLowerCase();
  return `${part("weekday")} ${clock}${period ? ` ${period}` : ""} ${part("timeZoneName")}`;
};

export interface EmptyLineupWarning {
  round: number;
  emptyStarterSlots: number;
  firstKickoff: string;
}

/** The nearest round that still has open starter slots before its first kickoff. */
export function emptyLineupWarning(
  lineups: RoundLineup[],
  rosterSize: number,
  now: Date,
): EmptyLineupWarning | null {
  if (rosterSize === 0) return null;
  for (const lineup of lineups) {
    if (!lineup.firstKickoff || new Date(lineup.firstKickoff) <= now) continue;
    if (lineup.emptyStarterSlots === 0) continue;
    return {
      round: lineup.round,
      emptyStarterSlots: lineup.emptyStarterSlots,
      firstKickoff: lineup.firstKickoff,
    };
  }
  return null;
}

/** The round to open on: the first one whose games have not all kicked off yet. */
export function defaultRound(lineups: RoundLineup[], now: Date): number {
  const upcoming = lineups.find(
    (lineup) => lineup.firstKickoff && new Date(lineup.firstKickoff) > now,
  );
  if (upcoming) return upcoming.round;
  const started = lineups.filter((lineup) => lineup.firstKickoff);
  return started.at(-1)?.round ?? 1;
}
