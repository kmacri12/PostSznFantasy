import { Alert } from "@mui/material";
import { useSyncStatus } from "../../api/queries";

const BOX_SCORES = "box_scores";

export const formatAgo = (iso: string, now = Date.now()): string => {
  const minutes = Math.max(0, Math.floor((now - Date.parse(iso)) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)} h ago`;
  return `${Math.floor(minutes / (60 * 24))} d ago`;
};

/**
 * Pages with live scores: a warning only when live stats have stopped syncing for the day. The
 * routine sync time lives in the pull-to-refresh indicator; the admin's manual refresh lives in
 * the profile sheet, so these pages look the same for everyone.
 */
const LiveStatsNotice = () => {
  const status = useSyncStatus();
  const boxScores = status.data?.find((item) => item.kind === BOX_SCORES);
  const syncedAt = boxScores?.lastSyncedAt;
  if (!boxScores?.budgetExhausted || !syncedAt) return null;

  return (
    <Alert severity="warning" role="status" sx={{ width: "100%" }}>
      Live updates paused for today (API daily limit). Showing the last update from{" "}
      {formatAgo(syncedAt)}.
    </Alert>
  );
};

export default LiveStatsNotice;
