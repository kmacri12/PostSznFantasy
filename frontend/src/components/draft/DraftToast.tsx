import { Alert, Snackbar } from "@mui/material";
import type { Toast } from "../../hooks/draftRoomState";

const AUTO_HIDE_MS = 5000;

interface Props {
  toast: Toast | null;
  onClose: () => void;
  severity?: "error" | "info";
}

const DraftToast = ({ toast, onClose, severity = "error" }: Props) => (
  <Snackbar
    key={toast?.id}
    open={toast !== null}
    autoHideDuration={AUTO_HIDE_MS}
    onClose={(_, reason) => reason !== "clickaway" && onClose()}
    anchorOrigin={{ vertical: "top", horizontal: "center" }}
  >
    <Alert severity={severity} variant="filled" onClose={onClose} sx={{ width: "100%" }}>
      {toast?.message}
    </Alert>
  </Snackbar>
);

export default DraftToast;
