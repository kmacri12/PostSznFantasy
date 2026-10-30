import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";

interface Props {
  onConfirm: () => void;
  onCancel: () => void;
  pending: boolean;
}

/** Asked before a commissioner changes a locked slot; the league is told afterwards. */
const OverrideDialog = ({ onConfirm, onCancel, pending }: Props) => (
  <Dialog open onClose={onCancel} fullWidth maxWidth="xs" aria-labelledby="override-title">
    <DialogTitle id="override-title">Are you sure?</DialogTitle>
    <DialogContent>
      <Typography>This is a commissioner-only move and the league will be notified.</Typography>
    </DialogContent>
    <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
      <Button sx={{ minHeight: 44 }} onClick={onCancel}>
        Cancel
      </Button>
      <Button sx={{ minHeight: 44 }} variant="contained" disabled={pending} onClick={onConfirm}>
        Make the change
      </Button>
    </DialogActions>
  </Dialog>
);

export default OverrideDialog;
