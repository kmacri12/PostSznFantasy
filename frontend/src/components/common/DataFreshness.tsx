import RefreshIcon from "@mui/icons-material/Refresh";
import { Alert, Box, Button, Typography } from "@mui/material";
import { useRefreshLive, useSyncStatus } from "../../api/queries";
import { useUser } from "../../contexts/UserContext";
import { friendlyError } from "./friendlyError";

const BOX_SCORES = "box_scores";

export const formatAgo = (iso: string, now = Date.now()): string => {
  const minutes = Math.max(0, Math.floor((now - Date.parse(iso)) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)} h ago`;
  return `${Math.floor(minutes / (60 * 24))} d ago`;
};

/** Only hides the button: the server enforces who may call /api/admin/*. */
const isAdminHint = (userId: string | undefined): boolean =>
  !!userId &&
  (import.meta.env.VITE_ADMIN_SUPABASE_UIDS ?? "")
    .split(",")
    .map((id: string) => id.trim())
    .includes(userId);

/** "Stats updated X min ago" for pages showing live scores, plus an admin-only "Refresh now". */
const DataFreshness = () => {
  const { user } = useUser();
  const status = useSyncStatus();
  const refresh = useRefreshLive();
  const boxScores = status.data?.find((item) => item.kind === BOX_SCORES);
  const syncedAt = boxScores?.lastSyncedAt;

  if (status.isLoading) return null;

  // A failed refetch keeps the previous data, so the last known time stays on screen.
  const message = !status.data
    ? "Update time unavailable"
    : !syncedAt
      ? "Stats haven't synced yet"
      : `Stats updated ${formatAgo(syncedAt)}`;

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
      {boxScores?.budgetExhausted && syncedAt ? (
        <Alert severity="warning" role="status" sx={{ width: "100%" }}>
          Live updates paused for today (API daily limit). Showing the last update from{" "}
          {formatAgo(syncedAt)}.
        </Alert>
      ) : (
        <Typography variant="body2" color="text.secondary">
          {message}
        </Typography>
      )}
      {isAdminHint(user?.id) && (
        <Button
          size="small"
          variant="outlined"
          startIcon={<RefreshIcon />}
          disabled={refresh.isPending}
          onClick={() => refresh.mutate()}
        >
          Refresh now
        </Button>
      )}
      {refresh.isError && (
        <Typography variant="body2" color="error" role="alert">
          {friendlyError(refresh.error, "Couldn't refresh stats. Try again.")}
        </Typography>
      )}
    </Box>
  );
};

export default DataFreshness;
