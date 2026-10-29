import EditIcon from "@mui/icons-material/Edit";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { useAddDrop, usePlayerList, useRenameTeam, useTeam } from "../api/queries";
import type { RosterPlayer, RosterSlot, TeamDetails } from "../api/types";
import { tokens } from "../theme";

const detail = (error: unknown): string | null =>
  (error as { response?: { data?: { detail?: string } } } | null)?.response?.data?.detail ?? null;

const kickoff = (epoch: string | null): string | null => {
  const seconds = Number(epoch);
  return Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000).toLocaleString() : null;
};

const nextGameText = (player: RosterPlayer): string => {
  if (!player.isActive) return "Eliminated";
  if (!player.nextGame) return "No upcoming game";
  const when = kickoff(player.nextGame.gameTimeEpoch);
  return `vs ${player.nextGame.opponentAbv ?? "TBD"}${when ? ` · ${when}` : ""}`;
};

const SlotCard = ({ slot }: { slot: RosterSlot }) => {
  const player = slot.player;
  return (
    <Card
      sx={{
        p: 2,
        height: "100%",
        opacity: player ? 1 : 0.7,
        borderStyle: player ? "solid" : "dashed",
      }}
      data-testid={`slot-${slot.slot}`}
    >
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Chip size="small" label={slot.slot} sx={{ color: tokens.gold }} />
        {player && (
          <Chip
            size="small"
            color={player.isActive ? "success" : "default"}
            variant="outlined"
            label={player.isActive ? "Alive" : "Eliminated"}
          />
        )}
      </Box>
      {player ? (
        <>
          <Typography
            variant="h6"
            sx={{ mt: 1.5, textDecoration: player.isActive ? "none" : "line-through" }}
          >
            {player.name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {player.position} · {player.teamAbv || "FA"}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {nextGameText(player)}
          </Typography>
        </>
      ) : (
        <Typography color="text.secondary" sx={{ mt: 1.5 }}>
          Empty
        </Typography>
      )}
    </Card>
  );
};

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
          inputProps={{ maxLength: 40 }}
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

function TeamPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const { data: team, isLoading, isError } = useTeam(teamId);
  const [renaming, setRenaming] = useState(false);
  const [managing, setManaging] = useState(false);

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" py={8}>
        <CircularProgress />
      </Box>
    );
  }
  if (isError || !team) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error">This team isn't available to you.</Alert>
      </Container>
    );
  }

  const aliveCount = team.roster.filter((player) => player.isActive).length;

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Typography variant="h4">{team.name}</Typography>
        {team.canEdit && (
          <IconButton aria-label="Rename team" onClick={() => setRenaming(true)}>
            <EditIcon />
          </IconButton>
        )}
      </Box>
      <Box sx={{ display: "flex", gap: 1, alignItems: "center", mt: 1, mb: 3, flexWrap: "wrap" }}>
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
        <Alert severity="info" sx={{ mb: 2 }}>
          No players yet. Your lineup fills in as the draft happens.
        </Alert>
      )}
      <Grid container spacing={2}>
        {team.slots.map((slot, index) => (
          // Slots repeat (two RBs), so the position in the layout is the stable identity.
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed layout order
          <Grid item xs={12} sm={6} md={3} key={`${slot.slot}-${index}`}>
            <SlotCard slot={slot} />
          </Grid>
        ))}
      </Grid>

      {renaming && <RenameDialog team={team} onClose={() => setRenaming(false)} />}
      {managing && <AddDropDialog team={team} onClose={() => setManaging(false)} />}
    </Container>
  );
}

export default TeamPage;
