import React, { useState } from "react";
import {
  Button,
  Typography,
  Divider,
  Box,
  Grid,
  FormControl,
  InputLabel,
  OutlinedInput,
  IconButton,
  Collapse,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { useUser } from "../contexts/UserContext";
import { getAuth } from "firebase/auth";
import axios from "axios";
import RosterSettingsComponent from "../components/settings/RosterSettingsComponent";
import ScoringPassingSettingsComponent from "../components/settings/ScoringPassingSettingsComponent";
import ScoringRushingSettingsComponent from "../components/settings/ScoringRushingSettingsComponent";
import ScoringCarryingSettingsComponent from "../components/settings/ScoringCarryingSettingsComponent";
import ScoringReceivingSettingsComponent from "../components/settings/ScoringReceivingSettingsComponent";
import ScoringKickingSettingsComponent from "../components/settings/ScoringKickingSettingsComponent";
import ScoringDSTSettingsComponent from "../components/settings/ScoringDSTSettingsComponent";

const CreateLeaguePage = () => {
  const userId = useUser();
  const [leagueName, setLeagueName] = useState("MyLeague");
  const [expanded, setExpanded] = useState({
    league: true,
    roster: false,
    passing: false,
    rushing: false,
    receiving: false,
    carrying: false,
    kicking: false,
    defense: false,
  });

  // Roster Settings
  const [rosterSettings, setRosterSettings] = useState({
    number_teams: 12,
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

  // Scoring Settings
  const [scoringSettings, setScoringSettings] = useState({
    scoring_passing_yard: 0,
    scoring_passing_td: 0,
    scoring_passing_2pt: 0,
    scoring_passing_interception: 0,
    scoring_passing_completion: 0,
    scoring_passing_attempt: 0,
    scoring_passing_sack: 0,
    scoring_rushing_yard: 0,
    scoring_rushing_td: 0,
    scoring_rushing_2pt: 0,
    scoring_rushing_attempt: 0,
    scoring_receiving_reception: 0,
    scoring_receiving_yard: 0,
    scoring_receiving_td: 0,
    scoring_receiving_2pt: 0,
    scoring_receiving_target: 0,
    scoring_receiving_reception_bonus_rb: 0,
    scoring_receiving_reception_bonus_wr: 0,
    scoring_receiving_reception_bonus_te: 0,
    scoring_carrying_fumble: 0,
    scoring_carrying_fumble_lost: 0,
    scoring_special_punt_return_yard: 0,
    scoring_special_punt_return_td: 0,
    scoring_special_kick_return_yard: 0,
    scoring_special_kick_return_td: 0,
    scoring_kicking_fg_made: 0,
    scoring_kicking_fg_miss: 0,
    scoring_kicking_fg_made_0_19: 0,
    scoring_kicking_fg_made_20_29: 0,
    scoring_kicking_fg_made_30_39: 0,
    scoring_kicking_fg_made_40_49: 0,
    scoring_kicking_fg_made_50_plus: 0,
    scoring_kicking_fg_yard: 0,
    scoring_kicking_xp_made: 0,
    scoring_kicking_xp_miss: 0,
    scoring_dst_td: 0,
    scoring_dst_pts_allowed_0: 0,
    scoring_dst_pts_allowed_1_6: 0,
    scoring_dst_pts_allowed_7_13: 0,
    scoring_dst_pts_allowed_14_20: 0,
    scoring_dst_pts_allowed_21_27: 0,
    scoring_dst_pts_allowed_28_34: 0,
    scoring_dst_pts_allowed_35_plus: 0,
    scoring_dst_yards_allowed_under_100: 0,
    scoring_dst_yards_allowed_100_199: 0,
    scoring_dst_yards_allowed_200_299: 0,
    scoring_dst_yards_allowed_300_399: 0,
    scoring_dst_yards_allowed_400_499: 0,
    scoring_dst_yards_allowed_500_plus: 0,
    scoring_dst_sack: 0,
    scoring_dst_safety: 0,
    scoring_dst_fumble_recover: 0,
    scoring_dst_interception: 0,
  });

  const handleExpandClick = (section: string) => {
    setExpanded((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
      console.error("No user is currently signed in.");
      return;
    }
    const idToken = await user.getIdToken();

    try {
      const response = await axios.post(
        "http://localhost:5000/api/league/create_league",
        {
          leagueName,
          rosterSettings,
          scoringSettings,
        },
        {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        }
      );

      if (response.status === 201) {
        // Handle success (e.g., navigate to another page or show a success message)
        console.log(response.data.message);
      }
    } catch (error) {
      console.error("Error creating league:", error);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ padding: 2 }}>
      <div id="league-info">
        <Typography
          variant="h6"
          gutterBottom
          onClick={() => handleExpandClick("league")}
        >
          League Information
          <IconButton size="small" edge="end">
            {expanded.league ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Typography>
        <Collapse in={expanded.league}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel htmlFor="league-name">Name</InputLabel>
                <OutlinedInput
                  id="league-name"
                  value={leagueName}
                  onChange={(e) => setLeagueName(e.target.value)}
                  label="League Name"
                  required
                />
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel htmlFor="number-teams">Teams</InputLabel>
                <OutlinedInput
                  id="number-teams"
                  type="number" // Ensure numeric input
                  value={rosterSettings.number_teams || ""}
                  onChange={(e) =>
                    setRosterSettings({
                      ...rosterSettings,
                      number_teams: parseInt(e.target.value, 10) || 0,
                    })
                  }
                  label="Teams"
                />
              </FormControl>
            </Grid>
          </Grid>
        </Collapse>
      </div>

      <Divider sx={{ margin: "20px 0" }} />

      <RosterSettingsComponent
        expanded={expanded.roster}
        rosterSettings={rosterSettings}
        setRosterSettings={(newSettings) =>
          setRosterSettings((prevSettings) => ({
            ...prevSettings,
            ...newSettings,
          }))
        }
        handleExpandClick={() => handleExpandClick("roster")}
      />

      <Divider sx={{ margin: "20px 0" }} />

      <ScoringPassingSettingsComponent
        expanded={expanded.passing}
        scoringSettings={scoringSettings}
        setScoringSettings={(newSettings) =>
          setScoringSettings((prevSettings) => ({
            ...prevSettings,
            ...newSettings,
          }))
        }
        handleExpandClick={() => handleExpandClick("passing")}
      />

      <Divider sx={{ margin: "20px 0" }} />

      <ScoringRushingSettingsComponent
        expanded={expanded.rushing}
        scoringSettings={scoringSettings}
        setScoringSettings={(newSettings) =>
          setScoringSettings((prevSettings) => ({
            ...prevSettings,
            ...newSettings,
          }))
        }
        handleExpandClick={() => handleExpandClick("rushing")}
      />

      <Divider sx={{ margin: "20px 0" }} />

      <ScoringReceivingSettingsComponent
        expanded={expanded.receiving}
        scoringSettings={scoringSettings}
        setScoringSettings={(newSettings) =>
          setScoringSettings((prevSettings) => ({
            ...prevSettings,
            ...newSettings,
          }))
        }
        handleExpandClick={() => handleExpandClick("receiving")}
      />

      <Divider sx={{ margin: "20px 0" }} />

      <ScoringCarryingSettingsComponent
        expanded={expanded.carrying}
        scoringSettings={scoringSettings}
        setScoringSettings={(newSettings) =>
          setScoringSettings((prevSettings) => ({
            ...prevSettings,
            ...newSettings,
          }))
        }
        handleExpandClick={() => handleExpandClick("carrying")}
      />

      <Divider sx={{ margin: "20px 0" }} />

      <ScoringKickingSettingsComponent
        expanded={expanded.kicking}
        scoringSettings={scoringSettings}
        setScoringSettings={(newSettings) =>
          setScoringSettings((prevSettings) => ({
            ...prevSettings,
            ...newSettings,
          }))
        }
        handleExpandClick={() => handleExpandClick("kicking")}
      />

      <Divider sx={{ margin: "20px 0" }} />

      <ScoringDSTSettingsComponent
        expanded={expanded.defense}
        scoringSettings={scoringSettings}
        setScoringSettings={(newSettings) =>
          setScoringSettings((prevSettings) => ({
            ...prevSettings,
            ...newSettings,
          }))
        }
        handleExpandClick={() => handleExpandClick("defense")}
      />

      <Button
        type="submit"
        variant="contained"
        color="primary"
        sx={{ marginTop: 2 }}
      >
        Create League
      </Button>
    </Box>
  );
};

export default CreateLeaguePage;
