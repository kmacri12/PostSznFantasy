import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";
import type { ReactNode } from "react";

interface Props {
  title: string;
  confirmLabel: string;
  /** Plain lines under the title. */
  lines?: string[];
  warnings?: string[];
  children?: ReactNode;
  disabled?: boolean;
  pending?: boolean;
  error?: string | null;
  /** The action cannot be taken back: the confirm button is red. */
  destructive?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/** The one confirmation every irreversible or costly draft action goes through. */
const ConfirmDraftAction = ({
  title,
  confirmLabel,
  lines = [],
  warnings = [],
  children,
  disabled,
  pending,
  error,
  destructive,
  onConfirm,
  onClose,
}: Props) => (
  <Dialog open onClose={onClose} fullWidth maxWidth="xs">
    <DialogTitle>{title}</DialogTitle>
    <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
      {error && <Alert severity="error">{error}</Alert>}
      {lines.map((line) => (
        <Typography key={line} color="text.secondary">
          {line}
        </Typography>
      ))}
      {warnings.map((warning) => (
        <Alert key={warning} severity="warning">
          {warning}
        </Alert>
      ))}
      {children}
    </DialogContent>
    <DialogActions sx={{ px: 3, pb: 2 }}>
      <Button onClick={onClose} sx={{ minHeight: 44 }}>
        Cancel
      </Button>
      <Button
        variant="contained"
        color={destructive ? "error" : "primary"}
        disabled={disabled || pending}
        onClick={onConfirm}
        sx={{ minHeight: 44 }}
      >
        {confirmLabel}
      </Button>
    </DialogActions>
  </Dialog>
);

export default ConfirmDraftAction;
