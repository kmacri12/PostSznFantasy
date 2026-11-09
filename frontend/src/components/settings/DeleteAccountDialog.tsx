import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useDeleteAccount } from "../../api/queries";
import { ACCOUNT_DELETION_SUMMARY } from "../../content/rules";
import { mutationError } from "../common/friendlyError";

interface Props {
  onDeleted: () => void;
  onClose: () => void;
}

/** One confirmation (#330): the API refuses while this member is a league's only commissioner. */
const DeleteAccountDialog = ({ onDeleted, onClose }: Props) => {
  const fullScreen = useMediaQuery(useTheme().breakpoints.down("sm"));
  const deleteAccount = useDeleteAccount();
  const failure = mutationError(deleteAccount.error, "Couldn't delete your account. Try again.");
  const touch = { minHeight: 44 };

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
          disabled={deleteAccount.isPending}
          onClick={() => deleteAccount.mutate(undefined, { onSuccess: onDeleted })}
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
