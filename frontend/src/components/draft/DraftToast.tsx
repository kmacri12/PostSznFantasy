import { Alert, Snackbar } from "@mui/material";
import type { Toast } from "../../hooks/draftRoomState";

const AUTO_HIDE_MS = 5000;

interface Props {
  toast: Toast | null;
  onClose: () => void;
}

const DraftToast = ({ toast, onClose }: Props) => (
  <Snackbar
    key={toast?.id}
    open={toast !== null}
    autoHideDuration={AUTO_HIDE_MS}
    onClose={(_, reason) => reason !== "clickaway" && onClose()}
    anchorOrigin={{ vertical: "top", horizontal: "center" }}
  >
    <Alert
      severity={toast?.severity ?? "error"}
      variant="filled"
      onClose={onClose}
      sx={{ width: "100%" }}
    >
      {toast?.message}
    </Alert>
  </Snackbar>
);

export default DraftToast;
