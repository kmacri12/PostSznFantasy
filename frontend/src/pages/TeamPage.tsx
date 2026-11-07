import EditIcon from "@mui/icons-material/Edit";
import {
  Alert,
  Box,
  Button,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
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
  useStandings,
  useTeam,
} from "../api/queries";
import type { TeamDetails } from "../api/types";
import DataFreshness from "../components/common/DataFreshness";
import EmptyState from "../components/common/EmptyState";
import { mutationError } from "../components/common/friendlyError";
import PictureAvatar from "../components/common/PictureAvatar";
import QueryBoundary from "../components/common/QueryBoundary";
import ArchivedNotice from "../components/league/ArchivedNotice";
import { formatPoints } from "../components/league/standingsView";
import LineupRound from "../components/team/LineupRound";
import {
  defaultRound,
  emptyLineupWarning,
  formatKickoff,
  ROUND_LABELS,
} from "../components/team/lineup";
import OverrideDialog from "../components/team/OverrideDialog";
import PlayerSheet from "../components/team/PlayerSheet";
import PreDraftRoster from "../components/team/PreDraftRoster";
import RoundStrip from "../components/team/RoundStrip";
import { useSeasonContext } from "../contexts/SeasonContext";
import { tokens } from "../theme";

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

/** Re-renders every 30s so the banner clears the moment a game starts. */
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
  const { season, seasonId, paths } = useSeasonContext();
  const archived = season.finished;
  const canEdit = team.canEdit && season.canEdit;
  const canSetLineup = team.canSetLineup && season.canEdit;
  const [renaming, setRenaming] = useState(false);
  const now = useNow();
  const standing = useStandings(seasonId).data?.teams.find((row) => row.teamId === teamId);
  const currentRound = defaultRound(team.lineups, now);
  const [round, setRound] = useState(currentRound);
  const [sheetPlayerId, setSheetPlayerId] = useState<number | null>(null);
  const moveInLineup = useMoveInLineup(teamId);
  // A locked move the server wants confirmed first; held until the commissioner answers.
  const [pendingOverride, setPendingOverride] = useState<LineupMoveRequest | null>(null);
  const move = (request: LineupMoveRequest) =>
    moveInLineup.mutate(request, {
      onSuccess: () => setSheetPlayerId(null),
      onError: (error) => {
        if (needsOverrideConfirmation(error)) setPendingOverride(request);
      },
    });
  const moveError = needsOverrideConfirmation(moveInLineup.error)
    ? null
    : mutationError(moveInLineup.error, "Couldn't move that player. Try again.");

  const lineup = team.lineups.find((entry) => entry.round === round);
  const warning = emptyLineupWarning(team.lineups, team.roster.length, now);
  const sheetPlayer =
    lineup && sheetPlayerId !== null
      ? [
          ...lineup.slots.map((slot) => slot.player),
          ...lineup.unassigned,
          ...lineup.eliminated,
        ].find((player) => player?.id === sheetPlayerId)
      : null;
  const isMine = season.myTeamId === team.id;
  const owner = isMine ? "You" : team.ownerName || "Unclaimed";

  return (
    <Container
      maxWidth="md"
      sx={{ py: { xs: 2, sm: 3 }, display: "flex", flexDirection: "column", gap: 1.5 }}
    >
      <Box
        sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1.5 }}
      >
        <PictureAvatar url={team.avatarUrl} name={team.name} size={48} />
        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Typography
              variant="h1"
              sx={{ fontSize: { xs: 20, md: 26 }, fontWeight: 700, overflowWrap: "anywhere" }}
            >
              {team.name}
            </Typography>
            {canEdit && (
              <IconButton aria-label="Rename team" onClick={() => setRenaming(true)} size="small">
                <EditIcon fontSize="small" />
              </IconButton>
            )}
          </Box>
          <Typography component="span" sx={{ fontSize: { xs: 12, md: 13 }, color: tokens.muted }}>
            {owner}
            {standing?.rank != null && ` · rank ${standing.rank}`}
          </Typography>
        </Box>
        {standing && (
          <Box sx={{ textAlign: "right", flexShrink: 0 }}>
            <Typography sx={{ fontSize: { xs: 20, md: 26 }, fontWeight: 700, lineHeight: 1.2 }}>
              {formatPoints(standing.total)}
            </Typography>
            <Typography component="span" sx={{ fontSize: { xs: 12, md: 13 }, color: tokens.muted }}>
              total
            </Typography>
          </Box>
        )}
      </Box>

      <DataFreshness />
      {archived && <ArchivedNotice what="names and lineups" />}
      {team.roster.length === 0 && <PreDraftRoster seasonId={seasonId} />}
      {team.roster.length === 0 && (
        <EmptyState
          title="No players yet"
          description="This lineup fills in as the draft happens."
          action={
            <Button component={Link} to={paths.draft} variant="outlined">
              Open the draft room
            </Button>
          }
        />
      )}
      {warning && canSetLineup && (
        <Alert severity="warning">
          {ROUND_LABELS[warning.round]}: {warning.emptyStarterSlots} empty starter{" "}
          {warning.emptyStarterSlots === 1 ? "slot" : "slots"}. First game{" "}
          {formatKickoff(warning.firstKickoff)}.
        </Alert>
      )}
      {lineup && team.roster.length > 0 && (
        <>
          <RoundStrip lineups={team.lineups} round={round} onSelect={setRound} />
          <LineupRound lineup={lineup} onOpenPlayer={(player) => setSheetPlayerId(player.id)} />
        </>
      )}
      {sheetPlayer && lineup && (
        <PlayerSheet
          player={sheetPlayer}
          lineup={lineup}
          canMove={canSetLineup && round >= currentRound}
          canOverride={team.canOverride && season.canEdit}
          ownTeam={isMine}
          pending={moveInLineup.isPending}
          error={moveError}
          onMove={(request) => move({ round, ...request })}
          onClose={() => {
            moveInLineup.reset();
            setSheetPlayerId(null);
          }}
        />
      )}

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
