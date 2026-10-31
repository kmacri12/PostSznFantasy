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
  Grid,
  IconButton,
  TextField,
  Typography,
} from "@mui/material";
import type React from "react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useLeague, useRecap, useUpdateLeague } from "../api/queries";
import type { LeagueOverview } from "../api/types";
import ActivityFeed from "../components/activity/ActivityFeed";
import DataFreshness from "../components/common/DataFreshness";
import { mutationError } from "../components/common/friendlyError";
import QueryBoundary from "../components/common/QueryBoundary";
import InvitePanel from "../components/league/InvitePanel";
import LeagueNotes from "../components/league/LeagueNotes";
import StandingsTable from "../components/league/StandingsTable";
import SeasonRecap from "../components/recap/SeasonRecap";

const DRAFT_LABELS: Record<LeagueOverview["draftStatus"], string> = {
  unscheduled: "Draft not scheduled",
  scheduled: "Draft scheduled",
  lobby: "Draft lobby open",
  in_progress: "Draft in progress",
  paused: "Draft paused",
  completed: "Draft complete",
};

const RenameDialog = ({ league, onClose }: { league: LeagueOverview; onClose: () => void }) => {
  const [name, setName] = useState(league.name);
  const update = useUpdateLeague(league.id);
  const updateError = mutationError(update.error, "Couldn't rename the league. Try again.");
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Rename league</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          margin="dense"
          label="League name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        {updateError && <Alert severity="error">{updateError}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!name.trim() || update.isPending}
          onClick={() => update.mutate({ name: name.trim() }, { onSuccess: onClose })}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

/** The league home: info, members, commissioner tools, draft status and standings. */
const LeagueContent = ({ league }: { league: LeagueOverview }) => {
  const [renaming, setRenaming] = useState(false);
  const isCommissioner = league.myRole === "commissioner";
  const recap = useRecap(league.id).data;
  const archived = recap?.finished === true;
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 1 }}>
        <Typography variant="h4" sx={{ overflowWrap: "anywhere" }}>
          {league.name}
        </Typography>
        {isCommissioner && !archived && (
          <IconButton aria-label="Rename league" onClick={() => setRenaming(true)}>
            <EditIcon />
          </IconButton>
        )}
        <Chip label={`${league.season} season`} size="small" />
        {archived && <Chip label="Archived" size="small" variant="outlined" />}
        <Chip
          label={isCommissioner ? "Commissioner" : "Member"}
          size="small"
          color={isCommissioner ? "primary" : "default"}
        />
      </Box>
      {archived && recap && (
        <Box sx={{ mb: 3 }}>
          <SeasonRecap
            recap={recap}
            isCommissioner={isCommissioner}
            nextLeagueId={recap.nextLeagueId}
          />
        </Box>
      )}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 3 }}>
        <Chip variant="outlined" label={DRAFT_LABELS[league.draftStatus]} />
        {league.draftStartTime && league.draftStatus === "scheduled" && (
          <Typography variant="body2" color="text.secondary">
            {new Date(league.draftStartTime).toLocaleString()}
          </Typography>
        )}
        <Typography variant="body2" color="text.secondary">
          {league.numberTeams} teams · {league.openSpots} open
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Button
          component={Link}
          to={`/league/${league.id}/draft`}
          variant={archived ? "outlined" : "contained"}
        >
          {archived ? "Draft results" : "Draft room"}
        </Button>
        {league.myTeamId && (
          <Button component={Link} to={`/team/${league.myTeamId}`} variant="outlined">
            My team
          </Button>
        )}
        <Button component={Link} to={`/settings?leagueId=${league.id}`} variant="outlined">
          {isCommissioner && !archived ? "Settings" : "View settings"}
        </Button>
      </Box>

      <Grid container spacing={3}>
        {isCommissioner && !archived && (
          <Grid size={{ xs: 12 }}>
            <InvitePanel leagueId={league.id} />
          </Grid>
        )}
        <Grid size={{ xs: 12 }}>
          <LeagueNotes league={league} readOnly={archived} />
        </Grid>
        <Grid size={{ xs: 12 }} sx={{ minWidth: 0 }}>
          <Typography variant="h6" sx={{ mb: 0.5 }}>
            Standings
          </Typography>
          <Box sx={{ mb: 1 }}>
            <DataFreshness />
          </Box>
          <StandingsTable leagueId={String(league.id)} />
        </Grid>
        <Grid size={{ xs: 12 }} sx={{ minWidth: 0 }}>
          <ActivityFeed scope="leagues" id={league.id} title="League activity" />
        </Grid>
      </Grid>

      {renaming && <RenameDialog league={league} onClose={() => setRenaming(false)} />}
    </Container>
  );
};

const LeaguePage: React.FC = () => {
  const { leagueId } = useParams<{ leagueId: string }>();
  const query = useLeague(leagueId);
  return (
    <QueryBoundary query={query} what="this league" page>
      {(league) => <LeagueContent league={league} />}
    </QueryBoundary>
  );
};

export default LeaguePage;
