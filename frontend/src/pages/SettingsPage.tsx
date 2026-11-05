import { Alert, Box, Button, Chip, Container, Paper, TextField, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import {
  useDraft,
  useLeagueInfo,
  useLeagueSettings,
  useUpdateLeague,
  useUpdateSeason,
  useUpdateSettings,
} from "../api/queries";
import ErrorState from "../components/common/ErrorState";
import { mutationError } from "../components/common/friendlyError";
import HelpTip from "../components/common/HelpTip";
import LoadingState from "../components/common/LoadingState";
import DraftSetupPanel from "../components/draft/DraftSetupPanel";
import ArchivedNotice from "../components/league/ArchivedNotice";
import DeleteLeagueDialog from "../components/settings/DeleteLeagueDialog";
import { valuesEqual } from "../components/settings/dirty";
import MembersSection from "../components/settings/MembersSection";
import PostseasonForm from "../components/settings/PostseasonForm";
import RosterForm from "../components/settings/RosterForm";
import ScoringForm from "../components/settings/ScoringForm";
import SettingsGroup from "../components/settings/SettingsGroup";
import { SETTING_HELP } from "../content/rules";
import { useSeasonContext } from "../contexts/SeasonContext";
import { fromApi, postseasonFromApi, ROSTER_KEYS, SCORING_KEYS } from "../settings/convert";
import { POSTSEASON_KEYS, type PostseasonValues } from "../settings/postseasonFields";
import type { SettingsValues } from "../settings/types";
import { TAB_BAR_HEIGHT } from "../theme";

/** One page, grouped sections: League, Roster, Scoring, Draft, Postseason. */
function SettingsPage() {
  const { leagueId, seasonId, season } = useSeasonContext();
  const info = useLeagueInfo(leagueId, !season.isFormerMember).data;
  const archived = season.finished;
  const settingsQuery = useLeagueSettings(seasonId);
  const draft = useDraft(seasonId);
  const updateSettings = useUpdateSettings(seasonId);
  const updateLeague = useUpdateLeague(leagueId);
  const updateSeason = useUpdateSeason(seasonId);
  // The league's name belongs to the league and stays editable; everything else is the season's.
  const canRename = info?.myRole === "commissioner";
  const canEdit = season.canCommission;

  const [name, setName] = useState("");
  const [teamCount, setTeamCount] = useState("");
  const [roster, setRoster] = useState<SettingsValues>({});
  const [scoring, setScoring] = useState<SettingsValues>({});
  const [postseason, setPostseason] = useState<PostseasonValues>({});
  const [deleting, setDeleting] = useState(false);

  const baseline = useMemo(
    () =>
      settingsQuery.data
        ? {
            roster: fromApi(settingsQuery.data, ROSTER_KEYS),
            scoring: fromApi(settingsQuery.data, SCORING_KEYS),
            postseason: postseasonFromApi(settingsQuery.data, POSTSEASON_KEYS),
            league: { name: season.leagueName, teamCount: season.numberTeams },
          }
        : null,
    [settingsQuery.data, season],
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
    setName(season.leagueName);
    setTeamCount(String(season.numberTeams));
  }, [season]);

  if (settingsQuery.isLoading) {
    return (
      <Container maxWidth="md" sx={{ py: 3 }}>
        <LoadingState what="settings" />
      </Container>
    );
  }
  if (settingsQuery.isError) {
    return (
      <Container maxWidth="md" sx={{ py: 3 }}>
        <ErrorState
          message="Couldn't load this league's settings. Check your connection and try again."
          onRetry={() => settingsQuery.refetch()}
        />
      </Container>
    );
  }

  const started = ["in_progress", "paused", "completed"].includes(draft.data?.status ?? "");

  const save = async () => {
    if (canEdit) {
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
    }
    if (canRename && name.trim() !== season.leagueName) {
      await updateLeague.mutateAsync({ name: name.trim() });
    }
    if (canEdit && !started && Number(teamCount) !== season.numberTeams) {
      await updateSeason.mutateAsync({ numberTeams: Number(teamCount) });
    }
  };

  const failure =
    mutationError(updateSettings.error, "Couldn't save the settings. Try again.") ??
    mutationError(updateLeague.error, "Couldn't save the league details. Try again.") ??
    mutationError(updateSeason.error, "Couldn't save the team count. Try again.");
  const saving = updateSettings.isPending || updateLeague.isPending || updateSeason.isPending;

  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      <Typography variant="h4" gutterBottom>
        League Settings
      </Typography>
      {archived && <ArchivedNotice what="settings" />}
      {!canEdit && !archived && !season.isFormerMember && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Only commissioners can change settings.
        </Alert>
      )}
      {started && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          The draft has started, so team count, roster slots, position caps and draft order are
          locked. Scoring and round multipliers can still change.
        </Alert>
      )}

      <SettingsGroup title="League" defaultExpanded>
        <Box sx={{ display: "grid", gap: 2 }}>
          <TextField
            label="League name"
            value={name}
            slotProps={{ htmlInput: { readOnly: !canRename, maxLength: 60 } }}
            onChange={(event) => setName(event.target.value)}
          />
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <TextField
              fullWidth
              label="Number of teams"
              value={teamCount}
              slotProps={{
                htmlInput: { readOnly: !canEdit || started, inputMode: "numeric" },
              }}
              onChange={(event) => setTeamCount(event.target.value)}
            />
            <HelpTip label="Number of teams" text={SETTING_HELP.numberTeams} />
          </Box>
          <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
            <Chip label={`${season.year} season`} />
            <Typography variant="body2" color="text.secondary">
              Commissioners:{" "}
              {(info?.members ?? [])
                .filter((member) => member.role === "commissioner")
                .map((member) => member.username)
                .join(", ")}
            </Typography>
          </Box>
        </Box>
      </SettingsGroup>

      {info && info.currentSeasonId === seasonId && (
        <SettingsGroup title="Members">
          <MembersSection season={season} canManage={canRename} />
        </SettingsGroup>
      )}

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

      {canRename && info && (
        <SettingsGroup title="Delete league">
          <Typography color="text.secondary" sx={{ mb: 1.5 }}>
            Deletes the league and all its seasons for every member. This cannot be undone.
          </Typography>
          <Button
            variant="outlined"
            color="error"
            sx={{ minHeight: 44 }}
            onClick={() => setDeleting(true)}
          >
            Delete league
          </Button>
          {deleting && (
            <DeleteLeagueDialog
              leagueId={leagueId}
              leagueName={info.name}
              seasonCount={info.seasons.length}
              onClose={() => setDeleting(false)}
            />
          )}
        </SettingsGroup>
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
      {(canEdit || canRename) && dirty && (
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
          <Button onClick={discard} disabled={saving}>
            Discard
          </Button>
          <Button variant="contained" onClick={save} disabled={saving}>
            Save
          </Button>
        </Paper>
      )}
    </Container>
  );
}

export default SettingsPage;
