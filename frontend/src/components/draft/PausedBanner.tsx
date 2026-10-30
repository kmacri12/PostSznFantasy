import PauseCircleIcon from "@mui/icons-material/PauseCircle";
import { Alert } from "@mui/material";
import type { DraftStatus } from "../../api/types";

/** Visible to every member so nobody waits on a clock that has stopped. */
const PausedBanner = ({ status }: { status: DraftStatus }) =>
  status === "paused" ? (
    <Alert
      severity="warning"
      icon={<PauseCircleIcon />}
      role="status"
      sx={{ mt: 2, fontWeight: 600 }}
    >
      The commissioner paused the draft. Picks resume when they restart it.
    </Alert>
  ) : null;

export default PausedBanner;
