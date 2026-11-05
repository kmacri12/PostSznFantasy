import RefreshIcon from "@mui/icons-material/Refresh";
import { Alert, Box, Button, CircularProgress, Snackbar, Typography } from "@mui/material";
import { useState } from "react";
import { useRefreshLive, useSyncStatus } from "../../api/queries";
import { useUser } from "../../contexts/UserContext";
import { E2E_BUILD } from "../../utils/e2e";
import { friendlyError } from "./friendlyError";

interface Toast {
  severity: "success" | "info" | "error";
  message: string;
}

const refreshedMessage = (polled: number): Toast =>
  polled === 0
    ? {
        severity: "info",
        message: "Nothing to refresh: no live games, or the daily API limit is spent.",
      }
    : {
        severity: "success",
        message: `Refreshed: ${polled} live ${polled === 1 ? "game" : "games"} updated.`,
      };

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
  const [toast, setToast] = useState<Toast | null>(null);
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
          startIcon={
            refresh.isPending ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />
          }
          disabled={refresh.isPending}
          onClick={() =>
            refresh.mutate(undefined, {
              onSuccess: ({ polled }) => setToast(refreshedMessage(polled)),
              onError: (error) =>
                setToast({
                  severity: "error",
                  message: friendlyError(error, "Couldn't refresh stats. Try again."),
                }),
            })
          }
        >
          Refresh now
        </Button>
      )}
      <Snackbar
        key={toast?.message}
        open={toast !== null}
        autoHideDuration={E2E_BUILD ? null : 6000}
        onClose={(_, reason) => reason !== "clickaway" && setToast(null)}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert
          severity={toast?.severity ?? "info"}
          variant="filled"
          onClose={() => setToast(null)}
          sx={{ width: "100%" }}
        >
          {toast?.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default DataFreshness;
