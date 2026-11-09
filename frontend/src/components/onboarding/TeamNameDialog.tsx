import { Alert, Box, Button, Dialog, TextField, Typography } from "@mui/material";
import { type FormEvent, useEffect, useState } from "react";
import { useRenameTeam } from "../../api/queries";
import { markTeamNamePrompted } from "../../utils/displayName";
import { mutationError } from "../common/friendlyError";

interface Props {
  teamId: number | null;
  /** True from the render that sees a fresh join or create until this dialog is closed. */
  pending: boolean;
  onOpenChange: (open: boolean) => void;
}

/** After joining or creating a league: an optional team name instead of "Team 3". Asked once per team. */
const TeamNameDialog = ({ teamId, pending, onOpenChange }: Props) => {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const rename = useRenameTeam(teamId ?? undefined);

  useEffect(() => {
    if (!pending || teamId === null) return;
    markTeamNamePrompted(teamId);
    setValue("");
    setOpen(true);
    onOpenChange(true);
  }, [pending, teamId, onOpenChange]);

  const close = () => {
    setOpen(false);
    onOpenChange(false);
  };
  const trimmed = value.trim();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    rename.mutate(trimmed, { onSuccess: close });
  };

  if (!open) return null;
  return (
    <Dialog open fullWidth maxWidth="xs" onClose={close} aria-labelledby="team-name-title">
      <Box component="form" onSubmit={submit} sx={{ p: 2.5, display: "grid", gap: 2 }}>
        <Typography id="team-name-title" variant="h6" component="h2">
          Name your team
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Optional. It shows in the standings and the draft.
        </Typography>
        <TextField
          autoFocus
          fullWidth
          label="Team name"
          value={value}
          slotProps={{ htmlInput: { maxLength: 40 } }}
          onChange={(event) => setValue(event.target.value)}
        />
        {rename.isError && (
          <Alert severity="error">
            {mutationError(rename.error, "Couldn't save the team name. Try again.")}
          </Alert>
        )}
        <Button
          type="submit"
          variant="contained"
          sx={{ minHeight: 44 }}
          disabled={rename.isPending || trimmed === ""}
        >
          Save
        </Button>
        <Button onClick={close} sx={{ minHeight: 44 }}>
          Skip for now
        </Button>
      </Box>
    </Dialog>
  );
};

export default TeamNameDialog;
