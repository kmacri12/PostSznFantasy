import { Alert, Box, Button, Chip, Container, Paper, TextField, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
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
import { TAB_BAR_HEIGHT } from "../components/layout/BottomTabBar";
import { valuesEqual } from "../components/settings/dirty";
import MembersSection from "../components/settings/MembersSection";
import PostseasonForm from "../components/settings/PostseasonForm";
import RosterForm from "../components/settings/RosterForm";
import ScoringForm from "../components/settings/ScoringForm";
import SettingsGroup from "../components/settings/SettingsGroup";
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

  const baseline = useMemo(
    () =>
      settingsQuery.data && league.data
        ? {
            roster: fromApi(settingsQuery.data, ROSTER_KEYS),
            scoring: fromApi(settingsQuery.data, SCORING_KEYS),
            postseason: postseasonFromApi(settingsQuery.data, POSTSEASON_KEYS),
            league: { name: league.data.name, teamCount: league.data.numberTeams },
          }
        : null,
    [settingsQuery.data, league.data],
  );
  const dirty =
    baseline !== null &&
    !(
      valuesEqual(baseline.roster, roster) &&
      valuesEqual(baseline.scoring, scoring) &&
      valuesEqual(baseline.postseason, postseason) &&
      valuesEqual(baseline.league, { name: name, teamCount })
    );

  const discard = () => {
    if (!baseline) return;
    setRoster(baseline.roster);
    setScoring(baseline.scoring);
    setPostseason(baseline.postseason);
    setName(baseline.league.name);
    setTeamCount(String(baseline.league.teamCount));
  };

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

      <SettingsGroup title="League" defaultExpanded>
        <Box sx={{ display: "grid", gap: 2 }}>
          <TextField
            label="League name"
            value={name}
            slotProps={{ htmlInput: { readOnly: !canEdit, maxLength: 60 } }}
            onChange={(event) => setName(event.target.value)}
          />
          <TextField
            label="Number of teams"
            value={teamCount}
            slotProps={{
              htmlInput: { readOnly: !canEdit || started, inputMode: "numeric" },
            }}
            onChange={(event) => setTeamCount(event.target.value)}
          />
          <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
            <Chip label={`${league.data.season} season (read-only)`} />
            <Typography variant="body2" color="text.secondary">
              Commissioners:{" "}
              {league.data.members
                .filter((member) => member.role === "commissioner")
                .map((member) => member.username)
                .join(", ")}
            </Typography>
          </Box>
        </Box>
      </SettingsGroup>

      <SettingsGroup title="Members">
        <MembersSection league={league.data} />
      </SettingsGroup>

      <SettingsGroup title="Roster">
        <RosterForm values={roster} onChange={setRoster} disabled={!canEdit || started} />
      </SettingsGroup>
      <SettingsGroup title="Scoring">
        <ScoringForm
          values={scoring}
          disabled={!canEdit}
          onChange={(key, rawValue) => setScoring((previous) => ({ ...previous, [key]: rawValue }))}
        />
      </SettingsGroup>
      <SettingsGroup title="Postseason">
        <PostseasonForm
          values={postseason}
          disabled={!canEdit}
          onChange={(key, value) => setPostseason((previous) => ({ ...previous, [key]: value }))}
        />
      </SettingsGroup>
      {draft.data && (
        <Box sx={{ mb: 1.5 }}>
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
      {canEdit && dirty && (
        <Paper
          role="region"
          aria-label="Unsaved changes"
          sx={{
            position: "sticky",
            bottom: { xs: TAB_BAR_HEIGHT, md: 0 },
            zIndex: (theme) => theme.zIndex.appBar - 1,
            mt: 2,
            p: 1.5,
            display: "flex",
            alignItems: "center",
            gap: 1,
            borderColor: "primary.main",
          }}
        >
          <Typography sx={{ flexGrow: 1 }}>Unsaved changes</Typography>
          <Button onClick={discard} disabled={updateSettings.isPending || updateLeague.isPending}>
            Discard
          </Button>
          <Button
            variant="contained"
            onClick={save}
            disabled={updateSettings.isPending || updateLeague.isPending}
          >
            Save
          </Button>
        </Paper>
      )}
    </Container>
  );
}

export default SettingsPage;
