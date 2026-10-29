import { Alert, Box, Button, CircularProgress, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useLeagueSettings, useUpdateSettings } from "../api/queries";
import LeagueInfo from "../components/settings/LeagueInfo";
import RosterForm from "../components/settings/RosterForm";
import ScoringForm from "../components/settings/ScoringForm";
import { ROSTER_KEYS, SCORING_KEYS, fromApi } from "../settings/convert";
import type { SettingsValues } from "../settings/types";

function SettingsPage() {
  const [searchParams] = useSearchParams();
  const leagueId = searchParams.get("leagueId") ?? undefined;
  const settingsQuery = useLeagueSettings(leagueId);
  const updateSettings = useUpdateSettings(leagueId);

  const [roster, setRoster] = useState<SettingsValues>({});
  const [scoring, setScoring] = useState<SettingsValues>({});

  useEffect(() => {
    if (!settingsQuery.data) return;
    setRoster(fromApi(settingsQuery.data, ROSTER_KEYS));
    setScoring(fromApi(settingsQuery.data, SCORING_KEYS));
  }, [settingsQuery.data]);

  if (!leagueId) {
    return <Alert severity="info">Pick a league to view its settings.</Alert>;
  }
  if (settingsQuery.isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }
  if (settingsQuery.isError) {
    return <Alert severity="error">Could not load this league's settings.</Alert>;
  }

  const handleSave = () =>
    updateSettings.mutate({
      rosterSettings: roster,
      scoringSettings: Object.fromEntries(
        Object.entries(scoring).map(([key, value]) => [key, Number(value) || 0]),
      ),
    });

  return (
    <Box sx={{ p: 3, maxWidth: 960, mx: "auto" }}>
      <Typography variant="h4" gutterBottom>
        League Settings
      </Typography>
      <LeagueInfo
        leagueName={`League #${leagueId}`}
        season={2025}
        totalTeams={Number(roster.number_teams) || 0}
      />

      <Box sx={{ mt: 2 }}>
        <RosterForm values={roster} onChange={setRoster} />
      </Box>
      <Box sx={{ mt: 3 }}>
        <ScoringForm
          values={scoring}
          onChange={(key, rawValue) => setScoring((previous) => ({ ...previous, [key]: rawValue }))}
        />
      </Box>

      {updateSettings.isError && (
        <Alert severity="error" sx={{ mt: 2 }}>
          Could not save settings. Only commissioners can change them.
        </Alert>
      )}
      {updateSettings.isSuccess && (
        <Alert severity="success" sx={{ mt: 2 }}>
          Settings saved.
        </Alert>
      )}
      <Button
        variant="contained"
        onClick={handleSave}
        disabled={updateSettings.isPending}
        sx={{ mt: 3 }}
      >
        Save Settings
      </Button>
    </Box>
  );
}

export default SettingsPage;
