import EditIcon from "@mui/icons-material/Edit";
import {
  Alert,
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
import type React from "react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useLeague, useUpdateLeague } from "../api/queries";
import type { LeagueOverview } from "../api/types";
import InvitePanel from "../components/league/InvitePanel";
import MembersPanel from "../components/league/MembersPanel";
import StandingsTable from "../components/league/StandingsTable";

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
const LeaguePage: React.FC = () => {
  const { leagueId } = useParams<{ leagueId: string }>();
  const { data: league, isLoading, isError } = useLeague(leagueId);
  const [renaming, setRenaming] = useState(false);

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" py={8}>
        <CircularProgress />
      </Box>
    );
  }
  if (isError || !league) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="error">You don't have access to this league.</Alert>
      </Container>
    );
  }

  const isCommissioner = league.myRole === "commissioner";
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 1 }}>
        <Typography variant="h4" sx={{ overflowWrap: "anywhere" }}>
          {league.name}
        </Typography>
        {isCommissioner && (
          <IconButton aria-label="Rename league" onClick={() => setRenaming(true)}>
            <EditIcon />
          </IconButton>
        )}
        <Chip label={`${league.season} season`} size="small" />
        <Chip
          label={isCommissioner ? "Commissioner" : "Member"}
          size="small"
          color={isCommissioner ? "primary" : "default"}
        />
      </Box>
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
        <Button component={Link} to={`/league/${league.id}/draft`} variant="contained">
          Draft room
        </Button>
        {league.myTeamId && (
          <Button component={Link} to={`/team/${league.myTeamId}`} variant="outlined">
            My team
          </Button>
        )}
        <Button component={Link} to={`/settings?leagueId=${league.id}`} variant="outlined">
          {isCommissioner ? "Settings" : "View settings"}
        </Button>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={isCommissioner ? 8 : 12} sx={{ minWidth: 0 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>
            Members
          </Typography>
          <MembersPanel league={league} />
        </Grid>
        {isCommissioner && (
          <Grid item xs={12} md={4}>
            <InvitePanel leagueId={league.id} />
          </Grid>
        )}
        <Grid item xs={12} sx={{ minWidth: 0 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>
            Standings
          </Typography>
          <Card sx={{ p: 0, bgcolor: "transparent", boxShadow: "none" }}>
            <StandingsTable leagueId={String(league.id)} />
          </Card>
        </Grid>
      </Grid>

      {renaming && <RenameDialog league={league} onClose={() => setRenaming(false)} />}
    </Container>
  );
};

export default LeaguePage;
