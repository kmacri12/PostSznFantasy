import { Alert, Box, Button, Dialog, TextField, Typography } from "@mui/material";
import { type FormEvent, useEffect, useState } from "react";
import { useRenameTeam, useTeam } from "../../api/queries";
import { useUser } from "../../contexts/UserContext";
import {
  isDefaultTeamName,
  markTeamNamePrompted,
  suggestedTeamName,
  teamNamePrompted,
} from "../../utils/displayName";
import { mutationError } from "../common/friendlyError";

interface Props {
  teamId: number | null;
  /** True from the render that sees a fresh join or create until this dialog is closed. */
  pending: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * After joining or creating a league: "Name your team", prefilled with the name the API already
 * gave it ("Team Kyle") so keeping it is one tap. It cannot be skipped or closed, and a reload
 * asks again until it is saved, so no team stays a bare "Team 3" on the draft board.
 */
const TeamNameDialog = ({ teamId, pending, onOpenChange }: Props) => {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const rename = useRenameTeam(teamId ?? undefined);
  const team = useTeam(teamId ?? undefined);
  const { username } = useUser();
  const current = team.data?.name;

  useEffect(() => {
    if (!pending || teamId === null || open || current === undefined) return;
    if (teamNamePrompted(teamId)) return; // saved already; a reload mid-dialog asks again
    // The API renames a "Team 3" after its owner when it is claimed; this is the fallback.
    setValue(isDefaultTeamName(current) ? suggestedTeamName(username) : current);
    setOpen(true);
    onOpenChange(true);
  }, [pending, teamId, open, current, username, onOpenChange]);

  const close = () => {
    if (teamId !== null) markTeamNamePrompted(teamId);
    setOpen(false);
    onOpenChange(false);
  };
  const trimmed = value.trim();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (trimmed === current) return close();
    rename.mutate(trimmed, { onSuccess: close });
  };

  if (!open) return null;
  return (
    <Dialog open fullWidth maxWidth="xs" aria-labelledby="team-name-title">
      <Box component="form" onSubmit={submit} sx={{ p: 2.5, display: "grid", gap: 2 }}>
        <Typography id="team-name-title" variant="h6" component="h2">
          Name your team
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          It shows in the standings and on the draft board. Keep this one or change it.
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
      </Box>
    </Dialog>
  );
};

export default TeamNameDialog;
