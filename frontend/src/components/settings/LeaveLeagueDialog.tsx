import {
  Alert,
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from "@mui/material";
import { useLeaveLeague } from "../../api/queries";
import { LEAVE_LAST_COMMISSIONER_NOTE, LEAVE_LEAGUE_NOTE } from "../../content/rules";
import Dialog from "../common/AppDialog";
import { mutationError } from "../common/friendlyError";

interface Props {
  leagueId: number;
  userId: number | null;
  leagueName: string;
  /** The only commissioner cannot leave until someone else takes over. */
  onlyCommissioner: boolean;
  onOpenMembers: () => void;
  onClose: () => void;
}

const LeaveLeagueDialog = ({
  leagueId,
  userId,
  leagueName,
  onlyCommissioner,
  onOpenMembers,
  onClose,
}: Props) => {
  const leave = useLeaveLeague(leagueId, userId);
  const failure = mutationError(leave.error, "Couldn't leave the league. Try again.");
  const touch = { minHeight: 44 };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs" aria-labelledby="leave-league-title">
      <DialogTitle id="leave-league-title">Leave {leagueName}?</DialogTitle>
      <DialogContent>
        {onlyCommissioner ? (
          <Alert severity="warning" icon={false}>
            {LEAVE_LAST_COMMISSIONER_NOTE}
          </Alert>
        ) : (
          <DialogContentText>{LEAVE_LEAGUE_NOTE}</DialogContentText>
        )}
        {failure && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {failure}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button sx={touch} onClick={onClose}>
          Cancel
        </Button>
        {onlyCommissioner ? (
          <Button variant="contained" sx={touch} onClick={onOpenMembers}>
            Open members
          </Button>
        ) : (
          <Button
            color="error"
            variant="contained"
            sx={touch}
            disabled={leave.isPending}
            onClick={() => leave.mutate()}
          >
            Leave league
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default LeaveLeagueDialog;
