import {
  Alert,
  Button,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useState } from "react";
import { useDeleteLeague } from "../../api/queries";
import Dialog from "../common/AppDialog";
import { mutationError } from "../common/friendlyError";

interface Props {
  leagueId: number;
  leagueName: string;
  seasonCount: number;
  onClose: () => void;
}

const seasonsPhrase = (count: number) =>
  count === 1
    ? "its 1 season,"
    : count === 2
      ? "both of its 2 seasons,"
      : `all ${count} of its seasons,`;

/** Always the same three steps (#231): warning, type the exact name, a final "Are you sure?". */
const DeleteLeagueDialog = ({ leagueId, leagueName, seasonCount, onClose }: Props) => {
  const fullScreen = useMediaQuery(useTheme().breakpoints.down("sm"));
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [typed, setTyped] = useState("");
  const deleteLeague = useDeleteLeague(leagueId);
  const failure = mutationError(deleteLeague.error, "Couldn't delete the league. Try again.");
  const touch = { minHeight: 44 };

  return (
    <Dialog
      open
      onClose={onClose}
      fullScreen={fullScreen}
      fullWidth
      maxWidth="xs"
      aria-labelledby="delete-league-title"
    >
      <DialogTitle id="delete-league-title">
        {step === 3 ? "Are you sure?" : `Delete ${leagueName}`}
      </DialogTitle>
      <DialogContent>
        {step === 1 && (
          <Alert severity="error" icon={false}>
            <Typography sx={{ fontWeight: 700, mb: 1 }}>
              Deleting a league is permanent and cannot be undone.
            </Typography>
            <Typography>
              {leagueName} and {seasonsPhrase(seasonCount)} with every team, roster, lineup,
              standing and recap, will be gone for every member.
            </Typography>
          </Alert>
        )}
        {step === 2 && (
          <>
            <Typography sx={{ mb: 2 }}>
              Type <strong>{leagueName}</strong> exactly to continue.
            </Typography>
            <TextField
              autoFocus
              fullWidth
              label="League name"
              value={typed}
              autoComplete="off"
              onChange={(event) => setTyped(event.target.value)}
            />
          </>
        )}
        {step === 3 && (
          <>
            <Typography sx={{ mb: 3 }}>
              {leagueName} will be deleted for everyone, right now. There is no way to get it back.
            </Typography>
            {/* Not where "Continue" was, so a double tap on the previous step can't land here. */}
            <Button
              fullWidth
              sx={touch}
              variant="contained"
              color="error"
              disabled={deleteLeague.isPending}
              onClick={() => deleteLeague.mutateAsync(typed).catch(() => undefined)}
            >
              Delete league forever
            </Button>
          </>
        )}
        {failure && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {failure}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1, flexWrap: "wrap" }}>
        <Button sx={touch} onClick={onClose}>
          Cancel
        </Button>
        {step < 3 && (
          <Button
            sx={touch}
            variant="outlined"
            color="error"
            disabled={step === 2 && typed !== leagueName}
            onClick={() => setStep(step === 1 ? 2 : 3)}
          >
            Continue
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default DeleteLeagueDialog;
