import type { SeasonOverview } from "../../api/types";
import { formatDraftTime } from "./countdown";

/** The one-line draft status under "Players" on the More tab. */
export const draftStatusLine = (
  season: Pick<SeasonOverview, "draftStatus" | "draftStartTime">,
): string => {
  switch (season.draftStatus) {
    case "unscheduled":
      return "Draft not scheduled";
    case "scheduled":
      return season.draftStartTime
        ? `Draft ${formatDraftTime(season.draftStartTime)}`
        : "Draft scheduled";
    case "lobby":
      return "Draft lobby open";
    case "in_progress":
      return "Draft under way";
    case "paused":
      return "Draft paused";
    case "completed":
      return "Draft complete";
  }
};
