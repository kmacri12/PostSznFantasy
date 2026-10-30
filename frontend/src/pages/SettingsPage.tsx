import { Alert, Box, Button, Chip, Container, Divider, TextField, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  useDraft,
  useLeague,
  useLeagueSettings,
  useUpdateLeague,
  useUpdateSettings,
} from "../api/queries";
import EmptyState from "../components/common/EmptyState";
import ErrorState from "../components/common/ErrorState";
import { mutationError } from "../components/common/friendlyError";
import LoadingState from "../components/common/LoadingState";
import DraftSetupPanel from "../components/draft/DraftSetupPanel";
import MembersSection from "../components/settings/MembersSection";
import PostseasonForm from "../components/settings/PostseasonForm";
import RosterForm from "../components/settings/RosterForm";
import ScoringForm from "../components/settings/ScoringForm";
import { fromApi, postseasonFromApi, ROSTER_KEYS, SCORING_KEYS } from "../settings/convert";
import { POSTSEASON_KEYS, type PostseasonValues } from "../settings/postseasonFields";
import type { SettingsValues } from "../settings/types";

/** One page, grouped sections: League, Roster, Scoring, Draft, Postseason. */
function SettingsPage() {
  const [searchParams] = useSearchParams();
  const leagueId = searchParams.get("leagueId") ?? undefined;
  const league = useLeague(leagueId);
  const settingsQuery = useLeagueSettings(leagueId);
  const draft = useDraft(leagueId);
  const updateSettings = useUpdateSettings(leagueId);
  const updateLeague = useUpdateLeague(leagueId);

  const [name, setName] = useState("");
  const [teamCount, setTeamCount] = useState("");
  const [roster, setRoster] = useState<SettingsValues>({});
  const [scoring, setScoring] = useState<SettingsValues>({});
  const [postseason, setPostseason] = useState<PostseasonValues>({});

  useEffect(() => {
    if (!settingsQuery.data) return;
    setRoster(fromApi(settingsQuery.data, ROSTER_KEYS));
    setScoring(fromApi(settingsQuery.data, SCORING_KEYS));
    setPostseason(postseasonFromApi(settingsQuery.data, POSTSEASON_KEYS));
  }, [settingsQuery.data]);

  useEffect(() => {
    if (!league.data) return;
    setName(league.data.name);
    setTeamCount(String(league.data.numberTeams));
  }, [league.data]);

  if (!leagueId) {
    return (
      <Container maxWidth="sm" sx={{ py: 4 }}>
        <EmptyState
          title="No league selected"
          description="Open a league to see its settings."
          action={
            <Button component={Link} to="/" variant="outlined">
              Go to your leagues
            </Button>
          }
        />
      </Container>
    );
  }
  if (league.isLoading || settingsQuery.isLoading) {
    return (
      <Container maxWidth="md" sx={{ py: 3 }}>
        <LoadingState what="settings" />
      </Container>
    );
  }
  if (league.isError || settingsQuery.isError || !league.data) {
    return (
      <Container maxWidth="md" sx={{ py: 3 }}>
        <ErrorState
          message="Couldn't load this league's settings. Check your connection and try again."
          onRetry={() => {
            league.refetch();
            settingsQuery.refetch();
          }}
        />
      </Container>
    );
  }

  const canEdit = league.data.myRole === "commissioner";
  const started = ["in_progress", "paused", "completed"].includes(draft.data?.status ?? "");

  const save = async () => {
    await updateSettings.mutateAsync({
      ...roster,
      ...Object.fromEntries(
        Object.entries(scoring).map(([key, value]) => [key, Number(value) || 0]),
      ),
      ...Object.fromEntries(
        Object.entries(postseason).map(([key, value]) => [
          key,
          key.startsWith("multiplier_") ? Number(value) || 0 : value,
        ]),
      ),
    });
    if (name.trim() !== league.data?.name || Number(teamCount) !== league.data?.numberTeams) {
      await updateLeague.mutateAsync({ name: name.trim(), numberTeams: Number(teamCount) });
    }
  };

  const failure =
    mutationError(updateSettings.error, "Couldn't save the settings. Try again.") ??
    mutationError(updateLeague.error, "Couldn't save the league details. Try again.");

  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      <Typography variant="h4" gutterBottom>
        League Settings
      </Typography>
      {!canEdit && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Only commissioners can change settings.
        </Alert>
      )}
      {started && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          The draft has started, so team count, roster size and draft order are locked.
        </Alert>
      )}

      <Typography variant="h6" sx={{ mb: 1 }}>
        League
      </Typography>
      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center", mb: 3 }}>
        <TextField
          label="League name"
          value={name}
          disabled={!canEdit}
          onChange={(event) => setName(event.target.value)}
        />
        <TextField
          label="Number of teams"
          value={teamCount}
          disabled={!canEdit || started}
          onChange={(event) => setTeamCount(event.target.value)}
          sx={{ width: 160 }}
        />
        <Chip label={`${league.data.season} season (read-only)`} />
        <Typography variant="body2" color="text.secondary">
          Commissioners:{" "}
          {league.data.members
            .filter((member) => member.role === "commissioner")
            .map((member) => member.username)
            .join(", ")}
        </Typography>
      </Box>
      <Divider sx={{ mb: 3 }} />

      <Box sx={{ mb: 3 }}>
        <MembersSection league={league.data} />
      </Box>
      <Divider sx={{ mb: 3 }} />

      <RosterForm values={roster} onChange={setRoster} disabled={!canEdit || started} />
      <Box sx={{ mt: 3 }}>
        <ScoringForm
          values={scoring}
          disabled={!canEdit}
          onChange={(key, rawValue) => setScoring((previous) => ({ ...previous, [key]: rawValue }))}
        />
      </Box>
      <Box sx={{ mt: 3 }}>
        <PostseasonForm
          values={postseason}
          disabled={!canEdit}
          onChange={(key, value) => setPostseason((previous) => ({ ...previous, [key]: value }))}
        />
      </Box>
      {draft.data && (
        <Box sx={{ mt: 3 }}>
          <DraftSetupPanel draft={draft.data} canEdit={canEdit} />
        </Box>
      )}

      {failure && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {failure}
        </Alert>
      )}
      {updateSettings.isSuccess && !failure && (
        <Alert severity="success" sx={{ mt: 2 }}>
          Settings saved.
        </Alert>
      )}
      {canEdit && (
        <Button
          variant="contained"
          onClick={save}
          disabled={updateSettings.isPending || updateLeague.isPending}
          sx={{ mt: 3 }}
        >
          Save settings
        </Button>
      )}
    </Container>
  );
}

export default SettingsPage;
