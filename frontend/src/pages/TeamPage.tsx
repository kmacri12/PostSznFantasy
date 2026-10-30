import EditIcon from "@mui/icons-material/Edit";
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  type LineupMoveRequest,
  needsOverrideConfirmation,
  useMoveInLineup,
  useRenameTeam,
  useTeam,
} from "../api/queries";
import type { TeamDetails } from "../api/types";
import ActivityFeed from "../components/activity/ActivityFeed";
import DataFreshness from "../components/common/DataFreshness";
import EmptyState from "../components/common/EmptyState";
import { mutationError } from "../components/common/friendlyError";
import QueryBoundary from "../components/common/QueryBoundary";
import LineupList from "../components/team/LineupList";
import {
  defaultRound,
  emptyLineupWarning,
  formatKickoff,
  ROUND_LABELS,
  ROUND_TAB_LABELS,
} from "../components/team/lineup";
import OverrideDialog from "../components/team/OverrideDialog";

const RenameDialog = ({ team, onClose }: { team: TeamDetails; onClose: () => void }) => {
  const [name, setName] = useState(team.name);
  const rename = useRenameTeam(team.id);
  const renameError = mutationError(rename.error, "Couldn't rename the team. Try again.");
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
        {renameError && <Alert severity="error">{renameError}</Alert>}
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

/** Re-renders every 30s so the banner clears the moment a kickoff passes. */
const useNow = () => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return now;
};

const TeamContent = ({ team }: { team: TeamDetails }) => {
  const teamId = team.id;
  const [renaming, setRenaming] = useState(false);
  const now = useNow();
  const [round, setRound] = useState(() => defaultRound(team.lineups, now));
  const moveInLineup = useMoveInLineup(teamId);
  // A locked move the server wants confirmed first; held until the commissioner answers.
  const [pendingOverride, setPendingOverride] = useState<LineupMoveRequest | null>(null);
  const move = (request: LineupMoveRequest) =>
    moveInLineup.mutate(request, {
      onError: (error) => {
        if (needsOverrideConfirmation(error)) setPendingOverride(request);
      },
    });
  const moveError = needsOverrideConfirmation(moveInLineup.error)
    ? null
    : mutationError(moveInLineup.error, "Couldn't move that player. Try again.");

  const lineup = team.lineups.find((entry) => entry.round === round);
  const warning = emptyLineupWarning(team.lineups, team.roster.length, now);
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
      </Box>

      <Box sx={{ mb: 2 }}>
        <DataFreshness />
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
      {warning && team.canSetLineup && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {ROUND_LABELS[warning.round]}: {warning.emptyStarterSlots} empty starter{" "}
          {warning.emptyStarterSlots === 1 ? "slot" : "slots"}. First kickoff{" "}
          {formatKickoff(warning.firstKickoff)}.
        </Alert>
      )}
      {lineup && (
        <>
          <Tabs
            value={round}
            onChange={(_, value: number) => setRound(value)}
            variant="fullWidth"
            aria-label="Round"
            sx={{ mb: 1.5, maxWidth: 760 }}
          >
            {team.lineups.map((entry) => (
              <Tab
                key={entry.round}
                value={entry.round}
                label={ROUND_TAB_LABELS[entry.round]}
                aria-label={ROUND_LABELS[entry.round]}
                sx={{ minWidth: 0, px: 0.5, fontSize: "0.8125rem" }}
              />
            ))}
          </Tabs>
          <LineupList
            key={round}
            lineup={lineup}
            canEdit={team.canSetLineup}
            canOverride={team.canOverride}
            onMove={(request) => move({ round, ...request })}
          />
        </>
      )}
      {moveError && (
        <Alert severity="error" sx={{ mt: 1 }}>
          {moveError}
        </Alert>
      )}

      <ActivityFeed scope="teams" id={team.id} title="Team activity" />

      {pendingOverride && (
        <OverrideDialog
          pending={moveInLineup.isPending}
          onCancel={() => setPendingOverride(null)}
          onConfirm={() => {
            move({ ...pendingOverride, confirmOverride: true });
            setPendingOverride(null);
          }}
        />
      )}
      {renaming && <RenameDialog team={team} onClose={() => setRenaming(false)} />}
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
