import EditIcon from "@mui/icons-material/Edit";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAddDrop, useMoveInLineup, usePlayerList, useRenameTeam, useTeam } from "../api/queries";
import type { RosterPlayer, TeamDetails } from "../api/types";
import EmptyState from "../components/common/EmptyState";
import QueryBoundary from "../components/common/QueryBoundary";
import LineupList from "../components/team/LineupList";

const detail = (error: unknown): string | null =>
  (error as { response?: { data?: { detail?: string } } } | null)?.response?.data?.detail ?? null;

const RenameDialog = ({ team, onClose }: { team: TeamDetails; onClose: () => void }) => {
  const [name, setName] = useState(team.name);
  const rename = useRenameTeam(team.id);
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Rename team</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          margin="dense"
          label="Team name"
          value={name}
          slotProps={{ htmlInput: { maxLength: 40 } }}
          onChange={(event) => setName(event.target.value)}
        />
        {detail(rename.error) && <Alert severity="error">{detail(rename.error)}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!name.trim() || rename.isPending}
          onClick={() => rename.mutate(name.trim(), { onSuccess: onClose })}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const AddDropDialog = ({ team, onClose }: { team: TeamDetails; onClose: () => void }) => {
  const players = usePlayerList();
  const addDrop = useAddDrop(team.id);
  const [drop, setDrop] = useState<RosterPlayer | null>(null);
  const [add, setAdd] = useState<{ id: number; name: string } | null>(null);
  const rostered = new Set(team.roster.map((player) => player.id));

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Add / drop</DialogTitle>
      <DialogContent sx={{ display: "grid", gap: 2, pt: 2 }}>
        <Autocomplete
          options={team.roster}
          value={drop}
          getOptionLabel={(player) => `${player.name} (${player.position})`}
          onChange={(_, value) => setDrop(value)}
          renderInput={(params) => <TextField {...params} label="Drop" />}
        />
        <Autocomplete
          options={(players.data ?? []).filter((player) => !rostered.has(player.id))}
          value={add}
          getOptionLabel={(player) => player.name}
          onChange={(_, value) => setAdd(value)}
          renderInput={(params) => <TextField {...params} label="Add free agent" />}
        />
        {detail(addDrop.error) && <Alert severity="error">{detail(addDrop.error)}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={(!drop && !add) || addDrop.isPending}
          onClick={() =>
            addDrop.mutate({ addPlayerId: add?.id, dropPlayerId: drop?.id }, { onSuccess: onClose })
          }
        >
          Confirm
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const TeamContent = ({ team }: { team: TeamDetails }) => {
  const teamId = team.id;
  const [renaming, setRenaming] = useState(false);
  const [managing, setManaging] = useState(false);
  const moveInLineup = useMoveInLineup(teamId);

  const aliveCount = team.roster.filter((player) => player.isActive).length;

  return (
    <Container maxWidth="md" sx={{ py: { xs: 2, sm: 4 } }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Typography variant="h4">{team.name}</Typography>
        {team.canEdit && (
          <IconButton aria-label="Rename team" onClick={() => setRenaming(true)}>
            <EditIcon />
          </IconButton>
        )}
      </Box>
      <Box sx={{ display: "flex", gap: 1, alignItems: "center", mt: 0.5, mb: 2, flexWrap: "wrap" }}>
        <Typography color="text.secondary">Owner: {team.ownerName || "Unclaimed"}</Typography>
        {team.roster.length > 0 && (
          <Chip
            size="small"
            color="success"
            variant="outlined"
            label={`${aliveCount} of ${team.roster.length} alive`}
          />
        )}
        <Box sx={{ flexGrow: 1 }} />
        {team.canManageRoster && (
          <Button variant="outlined" onClick={() => setManaging(true)}>
            Add / drop
          </Button>
        )}
      </Box>

      {team.roster.length === 0 && (
        <Box sx={{ mb: 2 }}>
          <EmptyState
            title="No players yet"
            description="This lineup fills in as the draft happens."
            action={
              <Button component={Link} to={`/league/${team.leagueId}/draft`} variant="outlined">
                Open the draft room
              </Button>
            }
          />
        </Box>
      )}
      <LineupList
        slots={team.slots}
        canDrag={team.canManageRoster}
        onMove={(move) => moveInLineup.mutate(move)}
      />
      {detail(moveInLineup.error) && (
        <Alert severity="error" sx={{ mt: 1 }}>
          {detail(moveInLineup.error)}
        </Alert>
      )}

      {renaming && <RenameDialog team={team} onClose={() => setRenaming(false)} />}
      {managing && <AddDropDialog team={team} onClose={() => setManaging(false)} />}
    </Container>
  );
};

function TeamPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const query = useTeam(teamId);
  return (
    <QueryBoundary query={query} what="this team" page>
      {(team) => <TeamContent key={team.id} team={team} />}
    </QueryBoundary>
  );
}

export default TeamPage;
