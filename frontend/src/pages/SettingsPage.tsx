import { Box, Button, CircularProgress, Typography } from "@mui/material";
import axios from "axios";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import LeagueInfo from "../components/settings/LeagueInfo";
import RosterSettingsComponent from "../components/settings/RosterSettingsComponent";
import ScoringDSTSettingsComponent from "../components/settings/ScoringDSTSettingsComponent";
import ScoringPassingSettingsComponent from "../components/settings/ScoringPassingSettingsComponent";
import ScoringReceivingSettingsComponent from "../components/settings/ScoringReceivingSettingsComponent";
import ScoringRushingSettingsComponent from "../components/settings/ScoringRushingSettingsComponent";
import ScoringSpecialTeamsSettingsComponent from "../components/settings/ScoringSpecialTeamsSettingsComponent";
import { useUser } from "../contexts/UserContext";
import { createLogger } from "../utils/logger";

const logger = createLogger("SettingsPage");

function SettingsPage() {
  const [searchParams] = useSearchParams();
  const leagueId = searchParams.get("leagueId");
  const apiUrl = import.meta.env.VITE_API_URL;
  const { getIdToken } = useUser();

  const [loading, setLoading] = useState(false);
  const [leagueDetails, setLeagueDetails] = useState<any>(null);
  const [rosterSettings, setRosterSettings] = useState<any>({
    number_teams: 12,
    roster_total: 18,
    roster_num_qb: 1,
    roster_num_rb: 2,
    roster_num_wr: 2,
    roster_num_te: 1,
    roster_num_flex_wr_rb_te: 1,
    roster_num_flex_wr_rb: 0,
    roster_num_flex_wr_te: 0,
    roster_num_flex_qb_wr_rb_te: 0,
    roster_num_k: 1,
    roster_num_dst: 1,
    roster_num_bench: 9,
    roster_max_qb: 2,
    roster_max_rb: 99,
    roster_max_wr: 99,
    roster_max_te: 99,
    roster_max_k: 2,
    roster_max_dst: 2,
  });

  const [scoringSettings, setScoringSettings] = useState<any>({
    scoring_passing_yard: 0,
    scoring_passing_td: 0,
    scoring_passing_2pt: 0,
    scoring_passing_interception: 0,
    scoring_rushing_yard: 0,
    scoring_rushing_td: 0,
    scoring_rushing_2pt: 0,
    scoring_receiving_reception: 0,
    scoring_receiving_yard: 0,
    scoring_receiving_td: 0,
    scoring_dst_td: 0,
    scoring_dst_sack: 0,
    scoring_dst_safety: 0,
  });

  const [expandedSection, setExpandedSection] = useState({
    roster: true,
    passing: false,
    rushing: false,
    receiving: false,
    specialTeams: false,
    defense: false,
  });

  useEffect(() => {
    if (!leagueId) return;
    setLoading(true);

    const fetchSettings = async () => {
      try {
        const token = await getIdToken();
        const response = await axios.get(`${apiUrl}/api/leagues/${leagueId}/settings`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (response.data) {
          setLeagueDetails(response.data);
          setRosterSettings((prev: any) => ({ ...prev, ...response.data }));
          setScoringSettings((prev: any) => ({ ...prev, ...response.data }));
        }
      } catch (err) {
        logger.error("Error fetching league settings:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [leagueId, apiUrl, getIdToken]);

  const toggleSection = (section: keyof typeof expandedSection) => {
    setExpandedSection((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const handleSave = async () => {
    if (!leagueId) return;
    try {
      const token = await getIdToken();
      await axios.put(
        `${apiUrl}/api/leagues/${leagueId}/settings`,
        {
          rosterSettings,
          scoringSettings,
        },
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        },
      );
      alert("Settings saved successfully!");
    } catch (err) {
      logger.error("Failed to update settings:", err);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ padding: 3 }}>
      <Typography variant="h4" gutterBottom>
        League Settings
      </Typography>

      <LeagueInfo
        leagueName={leagueDetails?.name || `League #${leagueId || ""}`}
        season={leagueDetails?.season || 2024}
        totalTeams={rosterSettings.number_teams}
      />

      <RosterSettingsComponent
        expanded={expandedSection.roster}
        rosterSettings={rosterSettings}
        setRosterSettings={setRosterSettings}
        handleExpandClick={() => toggleSection("roster")}
      />

      <Box sx={{ mt: 2 }} />

      <ScoringPassingSettingsComponent
        expanded={expandedSection.passing}
        scoringSettings={scoringSettings}
        setScoringSettings={setScoringSettings}
        handleExpandClick={() => toggleSection("passing")}
      />

      <Box sx={{ mt: 2 }} />

      <ScoringRushingSettingsComponent
        expanded={expandedSection.rushing}
        scoringSettings={scoringSettings}
        setScoringSettings={setScoringSettings}
        handleExpandClick={() => toggleSection("rushing")}
      />

      <Box sx={{ mt: 2 }} />

      <ScoringReceivingSettingsComponent
        expanded={expandedSection.receiving}
        scoringSettings={scoringSettings}
        setScoringSettings={setScoringSettings}
        handleExpandClick={() => toggleSection("receiving")}
      />

      <Box sx={{ mt: 2 }} />

      <ScoringSpecialTeamsSettingsComponent
        expanded={expandedSection.specialTeams}
        scoringSettings={scoringSettings}
        setScoringSettings={setScoringSettings}
        handleExpandClick={() => toggleSection("specialTeams")}
      />

      <Box sx={{ mt: 2 }} />

      <ScoringDSTSettingsComponent
        expanded={expandedSection.defense}
        scoringSettings={scoringSettings}
        setScoringSettings={setScoringSettings}
        handleExpandClick={() => toggleSection("defense")}
      />

      <Button variant="contained" color="primary" onClick={handleSave} sx={{ mt: 3 }}>
        Save Settings
      </Button>
    </Box>
  );
}

export default SettingsPage;
