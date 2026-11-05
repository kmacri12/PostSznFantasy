import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";
import { useDeleteMessage } from "../../api/queries";
import type { FeedMessageItem } from "../../api/types";
import { mutationError } from "../common/friendlyError";

interface Props {
  seasonId: number;
  message: FeedMessageItem;
  onClose: () => void;
}

const DeleteMessageDialog = ({ seasonId, message, onClose }: Props) => {
  const remove = useDeleteMessage(seasonId);
  const error = mutationError(remove.error, "Couldn't delete the message. Try again.");
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Delete this message?</DialogTitle>
      <DialogContent>
        <Typography color="text.secondary">
          It disappears for everyone in the league. This can't be undone.
        </Typography>
        {error && (
          <Typography color="error" sx={{ mt: 1 }}>
            {error}
          </Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ minHeight: 44 }}>
          Cancel
        </Button>
        <Button
          color="error"
          variant="contained"
          disabled={remove.isPending}
          onClick={() => remove.mutate(message.id, { onSuccess: onClose })}
          sx={{ minHeight: 44 }}
        >
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DeleteMessageDialog;
