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
import { useState } from "react";
import { Link } from "react-router-dom";
import { useLeagueInfo, useRecap, useUpdateLeague } from "../api/queries";
import type { LeagueInfo, SeasonOverview } from "../api/types";
import ActivityFeed from "../components/activity/ActivityFeed";
import DataFreshness from "../components/common/DataFreshness";
import { mutationError } from "../components/common/friendlyError";
import InvitePanel from "../components/league/InvitePanel";
import LeagueNotes from "../components/league/LeagueNotes";
import StandingsTable from "../components/league/StandingsTable";
import SeasonRecap from "../components/recap/SeasonRecap";
import { useSeasonContext } from "../contexts/SeasonContext";

const DRAFT_LABELS: Record<SeasonOverview["draftStatus"], string> = {
  unscheduled: "Draft not scheduled",
  scheduled: "Draft scheduled",
  lobby: "Draft lobby open",
  in_progress: "Draft in progress",
  paused: "Draft paused",
  completed: "Draft complete",
};

const RenameDialog = ({ league, onClose }: { league: LeagueInfo; onClose: () => void }) => {
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

/** Empty states a season can be in: no team for you, or teams nobody owned at the end. */
export const SeasonNotices = ({ season }: { season: SeasonOverview }) => (
  <>
    {season.myTeamId === null && !season.isFormerMember && (
      <Alert severity="info" sx={{ mb: 2 }}>
        {season.finished
          ? `You didn't have a team in the ${season.year} season.`
          : `You don't have a team in the ${season.year} season yet. Your commissioner can give you one from Settings.`}
      </Alert>
    )}
    {season.finished && season.openSpots > 0 && (
      <Alert severity="info" sx={{ mb: 2 }}>
        {season.openSpots === 1
          ? "One team had no owner when the season ended, so no one is credited for it."
          : `${season.openSpots} teams had no owner when the season ended, so no one is credited for them.`}
      </Alert>
    )}
  </>
);

/** A season's home: standings, draft status, notes, commissioner tools and the activity feed. */
const LeagueContent = () => {
  const { leagueId, seasonId, season, paths } = useSeasonContext();
  const [renaming, setRenaming] = useState(false);
  const info = useLeagueInfo(leagueId, !season.isFormerMember).data;
  const isCommissioner = info?.myRole === "commissioner";
  const archived = season.finished;
  const recap = useRecap(seasonId).data;
  const canStartSeason = isCommissioner && info?.canStartSeason === true;
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 1 }}>
        <Typography variant="h4" sx={{ overflowWrap: "anywhere" }}>
          {season.leagueName}
        </Typography>
        {isCommissioner && info && (
          <IconButton aria-label="Rename league" onClick={() => setRenaming(true)}>
            <EditIcon />
          </IconButton>
        )}
        <Chip label={`${season.year} season`} size="small" />
        {archived && <Chip label="Season over" size="small" variant="outlined" />}
        {season.isFormerMember ? (
          <Chip label="Former member" size="small" />
        ) : (
          <Chip
            label={isCommissioner ? "Commissioner" : "Member"}
            size="small"
            color={isCommissioner ? "primary" : "default"}
          />
        )}
      </Box>
      <SeasonNotices season={season} />
      {archived && recap && (
        <Box sx={{ mb: 3 }}>
          <SeasonRecap
            recap={recap}
            canStartSeason={canStartSeason && info?.currentSeasonId === seasonId}
          />
        </Box>
      )}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 3 }}>
        <Chip variant="outlined" label={DRAFT_LABELS[season.draftStatus]} />
        {season.draftStartTime && season.draftStatus === "scheduled" && (
          <Typography variant="body2" color="text.secondary">
            {new Date(season.draftStartTime).toLocaleString()}
          </Typography>
        )}
        <Typography variant="body2" color="text.secondary">
          {season.numberTeams} teams · {season.openSpots} open
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Button component={Link} to={paths.draft} variant={archived ? "outlined" : "contained"}>
          {archived ? "Draft results" : "Draft room"}
        </Button>
        {season.myTeamId && (
          <Button component={Link} to={paths.team(season.myTeamId)} variant="outlined">
            My team
          </Button>
        )}
        {!season.isFormerMember && (
          <Button component={Link} to={paths.settings} variant="outlined">
            {season.canCommission ? "Settings" : "View settings"}
          </Button>
        )}
      </Box>

      <Grid container spacing={3}>
        {info && (
          <Grid size={{ xs: 12 }}>
            <LeagueNotes league={info} />
          </Grid>
        )}
        {isCommissioner && !archived && (
          <Grid size={{ xs: 12 }}>
            <InvitePanel leagueId={leagueId} />
          </Grid>
        )}
        <Grid size={{ xs: 12 }} sx={{ minWidth: 0 }}>
          <Typography variant="h6" sx={{ mb: 0.5 }}>
            Standings
          </Typography>
          <Box sx={{ mb: 1 }}>
            <DataFreshness />
          </Box>
          <StandingsTable />
        </Grid>
        <Grid size={{ xs: 12 }} sx={{ minWidth: 0 }}>
          <ActivityFeed scope="seasons" id={seasonId} title="League activity" />
        </Grid>
      </Grid>

      {renaming && info && <RenameDialog league={info} onClose={() => setRenaming(false)} />}
    </Container>
  );
};

export default LeagueContent;
