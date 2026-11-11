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
import { useDeleteAccount } from "../../api/queries";
import { ACCOUNT_DELETION_SUMMARY } from "../../content/rules";
import Dialog from "../common/AppDialog";
import { mutationError } from "../common/friendlyError";

export const DELETE_PHRASE = "DELETE";

interface Props {
  onDeleted: () => void;
  onClose: () => void;
}

/**
 * Type-to-confirm (#375, like DeleteLeagueDialog): the destructive button stays disabled until
 * the member types DELETE exactly, and the API refuses a request without it. It also refuses
 * while this member is a league's only commissioner (#330).
 */
const DeleteAccountDialog = ({ onDeleted, onClose }: Props) => {
  const fullScreen = useMediaQuery(useTheme().breakpoints.down("sm"));
  const deleteAccount = useDeleteAccount();
  const failure = mutationError(deleteAccount.error, "Couldn't delete your account. Try again.");
  const touch = { minHeight: 44 };
  const [typed, setTyped] = useState("");
  const confirmed = typed.trim() === DELETE_PHRASE;
  const submit = () => {
    if (confirmed && !deleteAccount.isPending) {
      deleteAccount.mutate(DELETE_PHRASE, { onSuccess: onDeleted });
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      fullScreen={fullScreen}
      fullWidth
      maxWidth="xs"
      aria-labelledby="delete-account-title"
    >
      <DialogTitle id="delete-account-title">Delete my account</DialogTitle>
      <DialogContent>
        <Alert severity="error" icon={false}>
          <Typography sx={{ fontWeight: 700, mb: 1 }}>
            This is permanent and cannot be undone.
          </Typography>
          <Typography>{ACCOUNT_DELETION_SUMMARY}</Typography>
        </Alert>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <Typography sx={{ mt: 2, mb: 2 }}>
            Type <strong>{DELETE_PHRASE}</strong> to confirm.
          </Typography>
          <TextField
            fullWidth
            label="Confirmation"
            value={typed}
            autoComplete="off"
            autoCapitalize="characters"
            onChange={(event) => setTyped(event.target.value)}
            helperText={
              <span aria-live="polite">
                {confirmed ? "Ready: the button below will delete your account." : " "}
              </span>
            }
          />
        </form>
        {failure && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {failure}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ flexDirection: "column", alignItems: "stretch", gap: 1, p: 2 }}>
        <Button
          sx={touch}
          variant="contained"
          color="error"
          disabled={!confirmed || deleteAccount.isPending}
          onClick={submit}
        >
          Delete my account
        </Button>
        <Button sx={touch} onClick={onClose}>
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DeleteAccountDialog;
