// DEV-ONLY: Cleanly removable
import RefreshIcon from "@mui/icons-material/Refresh";
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";
import axios from "axios";
import type React from "react";
import { useState } from "react";
import { useUser } from "../../contexts/UserContext";
import { createLogger } from "../../utils/logger";

const logger = createLogger("DevQuickSync");

interface SyncResult {
  status: string;
  durationMs: number;
  synced: {
    teams: number;
    players: number;
    stats: number;
    games: number;
  };
}

export const DevQuickSync: React.FC = () => {
  const { user, getIdToken } = useUser();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!import.meta.env.DEV) {
    return null;
  }

  const handleSync = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const apiUrl = import.meta.env.VITE_API_URL;
      const token = await getIdToken();
      const response = await axios.post(
        `${apiUrl}/api/admin/update/all`,
        { withStats: true, withBoxScores: false },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      setResult(response.data);
    } catch (err: unknown) {
      logger.error("Quick sync failed:", err);
      setError("Failed to run sync. Check server logs.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="outlined"
        size="small"
        startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />}
        onClick={() => setOpen(true)}
        disabled={loading}
        sx={{
          ml: 2,
          textTransform: "none",
          borderColor: "rgba(255, 255, 255, 0.4)",
          color: "#ffc107",
          fontSize: "0.75rem",
          "&:hover": {
            borderColor: "#ffc107",
            backgroundColor: "rgba(255, 193, 7, 0.08)",
          },
        }}
      >
        [Dev] Seed NFL Data
      </Button>

      <Dialog open={open} onClose={() => !loading && setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Dev NFL Data Sync</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            Triggers the on-demand batch ingestion pipeline (<code>POST /api/admin/update/all</code>
            ) to seed teams, active players, and season stats into the local PostgreSQL database.
          </Typography>

          {!user && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              You must be signed in to execute the admin ingestion endpoint.
            </Alert>
          )}

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {result && (
            <Alert severity="success" sx={{ mb: 2 }}>
              <Typography variant="body2" fontWeight="bold">
                Sync Completed in {result.durationMs}ms!
              </Typography>
              <Typography variant="caption" display="block">
                • Teams: {result.synced.teams}
                <br />• Players: {result.synced.players}
                <br />• Season Stats: {result.synced.stats}
                <br />• Games: {result.synced.games}
              </Typography>
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={loading}>
            Close
          </Button>
          <Button
            onClick={handleSync}
            variant="contained"
            color="primary"
            disabled={loading || !user}
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />}
          >
            {loading ? "Syncing..." : "Run Sync Now"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
