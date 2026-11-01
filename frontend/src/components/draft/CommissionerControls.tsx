import SettingsIcon from "@mui/icons-material/Tune";
import { Alert, Box, Button, Drawer, Typography } from "@mui/material";
import { useState } from "react";
import { useDraftControl } from "../../api/queries";
import type { DraftState } from "../../api/types";
import { mutationError } from "../common/friendlyError";

const DRAFT_FAILURE = "Couldn't update the draft. Try again.";

/**
 * Lobby / start / pause / resume plus undo and force-pick, behind one button so the board
 * keeps the screen; commissioners only.
 */
const CommissionerControls = ({ draft }: { draft: DraftState }) => {
  const control = useDraftControl(draft.seasonId);
  const [open, setOpen] = useState(false);
  const run = (action: Parameters<typeof control.mutate>[0]) => () => {
    control.mutate(action, { onSuccess: () => setOpen(false) });
  };
  const status = draft.status;
  const preDraft = ["unscheduled", "scheduled", "lobby"].includes(status);
  const error = mutationError(control.error, DRAFT_FAILURE);

  return (
    <>
      <Button
        variant="outlined"
        startIcon={<SettingsIcon />}
        onClick={() => setOpen(true)}
        sx={{ flexShrink: 0 }}
      >
        Draft controls
      </Button>
      <Drawer
        anchor="bottom"
        open={open}
        onClose={() => setOpen(false)}
        slotProps={{ paper: { sx: { borderRadius: "16px 16px 0 0", p: 2, pb: 3 } } }}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
          Commissioner controls
        </Typography>
        <Box sx={{ display: "grid", gap: 1, maxWidth: 480, width: "100%", mx: "auto" }}>
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
              <Button variant="contained" onClick={run("pause")}>
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
          {error && <Alert severity="error">{error}</Alert>}
        </Box>
      </Drawer>
    </>
  );
};

export default CommissionerControls;
