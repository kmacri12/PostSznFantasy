import type { DraftStatus, LeagueByUser, Standings } from "../../api/types";
import { formatInViewerZone } from "../../utils/timeZone";

const ROUND_NAMES = ["Wild Card", "Divisional", "Conference Championship", "Super Bowl"];

export const ordinal = (n: number): string => {
  const lastTwo = n % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${n}th`;
  return `${n}${({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th"}`;
};

const draftDate = (iso: string): string =>
  formatInViewerZone(iso, { weekday: "short", hour: "numeric", minute: "2-digit" });

export interface PhaseTag {
  label: string;
  /** Something is happening right now: a draft or games in progress. */
  live: boolean;
}

/** The one-line phase a league card shows. `draftStart` is only read while a draft is scheduled. */
export const phaseTag = (
  league: Pick<LeagueByUser, "finished" | "draftStatus">,
  standings: Pick<Standings, "round" | "gamesInProgress"> | undefined,
  draftStart: string | null,
): PhaseTag => {
  if (league.finished) return { label: "Season over", live: false };
  const draft: Record<Exclude<DraftStatus, "completed">, PhaseTag> = {
    unscheduled: { label: "Draft not scheduled", live: false },
    scheduled: {
      label: draftStart ? `Draft ${draftDate(draftStart)}` : "Draft scheduled",
      live: false,
    },
    lobby: { label: "Draft lobby open", live: true },
    in_progress: { label: "Draft live", live: true },
    paused: { label: "Draft paused", live: true },
  };
  if (league.draftStatus !== "completed") return draft[league.draftStatus];
  const round = ROUND_NAMES[(standings?.round ?? 1) - 1] ?? ROUND_NAMES[0] ?? "";
  return { label: round, live: (standings?.gamesInProgress ?? 0) > 0 };
};

/** "T2" when another team shares the rank, so a tie is never read as a win. */
export const rankText = (
  rows: { teamId: number; rank: number | null }[],
  teamId: number | null,
): string | null => {
  const mine = rows.find((row) => row.teamId === teamId);
  if (!mine || mine.rank == null) return null;
  const shared = rows.some((row) => row.teamId !== teamId && row.rank === mine.rank);
  return shared ? `T${mine.rank}` : ordinal(mine.rank);
};
