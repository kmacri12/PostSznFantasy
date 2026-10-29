import { Alert, Box, Button, Paper, Typography } from "@mui/material";
import { useDraftControl } from "../../api/queries";
import type { DraftState } from "../../api/types";

const detail = (error: unknown): string | null =>
  (error as { response?: { data?: { detail?: string } } } | null)?.response?.data?.detail ?? null;

/** Lobby / start / pause / resume plus undo and force-pick; shown to commissioners only. */
const CommissionerControls = ({ draft }: { draft: DraftState }) => {
  const control = useDraftControl(draft.leagueId);
  const run = (action: Parameters<typeof control.mutate>[0]) => () => control.mutate(action);
  const status = draft.status;
  const preDraft = ["unscheduled", "scheduled", "lobby"].includes(status);

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
        Commissioner controls
      </Typography>
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
        {(status === "unscheduled" || status === "scheduled") && (
          <Button variant="outlined" onClick={run("lobby")}>
            Open lobby
          </Button>
        )}
        {preDraft && (
          <Button variant="contained" onClick={run("start")}>
            Start draft
          </Button>
        )}
        {status === "in_progress" && (
          <>
            <Button variant="outlined" onClick={run("pause")}>
              Pause
            </Button>
            <Button variant="outlined" onClick={run("force-pick")}>
              Auto-pick now
            </Button>
          </>
        )}
        {status === "paused" && (
          <Button variant="contained" onClick={run("resume")}>
            Resume
          </Button>
        )}
        {(status === "in_progress" || status === "paused" || status === "completed") && (
          <Button color="warning" variant="outlined" onClick={run("undo")}>
            Undo last pick
          </Button>
        )}
      </Box>
      {detail(control.error) && (
        <Alert severity="error" sx={{ mt: 1 }}>
          {detail(control.error)}
        </Alert>
      )}
    </Paper>
  );
};

export default CommissionerControls;
