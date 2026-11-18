import { Button, DialogActions, DialogContent, DialogTitle, Typography } from "@mui/material";
import Dialog from "../common/AppDialog";

interface Props {
  onConfirm: () => void;
  onCancel: () => void;
  pending: boolean;
  /** The team being changed, named in the warning. */
  teamName: string;
  /** The commissioner's own team: nobody else to notify. */
  ownTeam?: boolean;
  /** A player whose game has kicked off is involved: the stronger wording. */
  locked?: boolean;
}

/** Asked before a commissioner changes someone else's lineup or a locked slot; the league is told afterwards. */
const OverrideDialog = ({ onConfirm, onCancel, pending, teamName, ownTeam, locked }: Props) => (
  <Dialog open onClose={onCancel} fullWidth maxWidth="xs" aria-labelledby="override-title">
    <DialogTitle id="override-title">Commissioner action</DialogTitle>
    <DialogContent>
      <Typography>
        {ownTeam
          ? "You're changing your own lineup after kickoff."
          : `You're changing ${teamName}'s lineup. Its owner is notified.`}{" "}
        {locked
          ? "A player's game has already kicked off, so the league sees this in the Feed flagged as an after-kickoff override."
          : "The league sees this in the Feed."}
      </Typography>
    </DialogContent>
    <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
      <Button sx={{ minHeight: 44 }} onClick={onCancel}>
        Cancel
      </Button>
      <Button sx={{ minHeight: 44 }} variant="contained" disabled={pending} onClick={onConfirm}>
        Confirm
      </Button>
    </DialogActions>
  </Dialog>
);

export default OverrideDialog;
