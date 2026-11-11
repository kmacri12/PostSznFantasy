import { Alert, type AlertColor, Snackbar } from "@mui/material";
import { E2E_BUILD } from "../../utils/e2e";

interface Props {
  open: boolean;
  message: string;
  severity?: AlertColor;
  onClose: () => void;
  /** Milliseconds before it closes itself; the e2e build never does, so specs can read it. */
  autoHideMs?: number;
}

/** The one toast style of the app: top center, filled, closes itself after a few seconds. */
const AppToast = ({ open, message, severity = "success", onClose, autoHideMs = 5000 }: Props) => (
  <Snackbar
    open={open}
    autoHideDuration={E2E_BUILD ? null : autoHideMs}
    onClose={(_, reason) => reason !== "clickaway" && onClose()}
    anchorOrigin={{ vertical: "top", horizontal: "center" }}
  >
    <Alert severity={severity} variant="filled" onClose={onClose} sx={{ width: "100%" }}>
      {message}
    </Alert>
  </Snackbar>
);

export default AppToast;
