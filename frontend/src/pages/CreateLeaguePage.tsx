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

const CreateLeaguePage = () => {
  const userId = useUser();
  const [leagueName, setLeagueName] = useState("");
  const [expanded, setExpanded] = useState({
    league: true,
    roster: true,
    passing: true,
    rushing: true,
    receiving: true,
    carrying: true,
    specialTeams: true,
    kicking: true,
    defense: true,
  });

  // Roster Settings
  const [rosterSettings, setRosterSettings] = useState({
    number_teams: "",
    roster_num_qb: "",
    roster_num_rb: "",
    roster_num_wr: "",
    roster_num_te: "",
    roster_num_flex_wr_rb_te: "",
    roster_num_flex_wr_rb: "",
    roster_num_flex_wr_te: "",
    roster_num_flex_qb_wr_rb_te: "",
    roster_num_k: "",
    roster_num_dst: "",
    roster_num_total_size: "",
    roster_max_qb: "",
    roster_max_rb: "",
    roster_max_wr: "",
    roster_max_te: "",
    roster_max_k: "",
    roster_max_dst: "",
  });

  // Scoring Settings
  const [scoringSettings, setScoringSettings] = useState({
    scoring_passing_yard: "",
    scoring_passing_td: "",
    scoring_passing_2pt: "",
    scoring_passing_interception: "",
    scoring_passing_completion: "",
    scoring_passing_attempt: "",
    scoring_passing_sack: "",
    scoring_rushing_yard: "",
    scoring_rushing_td: "",
    scoring_rushing_2pt: "",
    scoring_rushing_attempt: "",
    scoring_receiving_reception: "",
    scoring_receiving_yard: "",
    scoring_receiving_td: "",
    scoring_receiving_2pt: "",
    scoring_receiving_target: "",
    scoring_receiving_reception_bonus_RB: "",
    scoring_receiving_reception_bonus_WR: "",
    scoring_receiving_reception_bonus_TE: "",
    scoring_carrying_fumble: "",
    scoring_carrying_fumble_lost: "",
    scoring_special_punt_return_yard: "",
    scoring_special_punt_return_td: "",
    scoring_special_kick_return_yard: "",
    scoring_special_kick_return_td: "",
    scoring_kicking_fg_made: "",
    scoring_kicking_fg_miss: "",
    scoring_kicking_fg_made_0_19: "",
    scoring_kicking_fg_made_20_29: "",
    scoring_kicking_fg_made_30_39: "",
    scoring_kicking_fg_made_40_49: "",
    scoring_kicking_fg_made_50_plus: "",
    scoring_kicking_fg_yard: "",
    scoring_kicking_xp_made: "",
    scoring_kicking_xp_miss: "",
    scoring_dst_td: "",
    scoring_dst_pts_allowed_0: "",
    scoring_dst_pts_allowed_1_6: "",
    scoring_dst_pts_allowed_7_13: "",
    scoring_dst_pts_allowed_14_20: "",
    scoring_dst_pts_allowed_21_27: "",
    scoring_dst_pts_allowed_28_34: "",
    scoring_dst_pts_allowed_35_plus: "",
    scoring_dst_yards_allowed_under_100: "",
    scoring_dst_yards_allowed_100_199: "",
    scoring_dst_yards_allowed_200_299: "",
    scoring_dst_yards_allowed_300_399: "",
    scoring_dst_yards_allowed_400_499: "",
    scoring_dst_yards_allowed_500_plus: "",
    scoring_dst_sack: "",
    scoring_dst_safety: "",
    scoring_dst_fumble_recover: "",
    scoring_dst_interception: "",
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
                  value={rosterSettings.number_teams}
                  onChange={(e) =>
                    setRosterSettings({
                      ...rosterSettings,
                      number_teams: e.target.value,
                    })
                  }
                  label=" Teams"
                />
              </FormControl>
            </Grid>
          </Grid>
        </Collapse>
      </div>

      <Divider sx={{ margin: "20px 0" }} />

      <div id="roster-settings">
        <Typography
          variant="h6"
          gutterBottom
          onClick={() => handleExpandClick("roster")}
        >
          Roster Settings{" "}
          <IconButton size="small" edge="end">
            {expanded.roster ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Typography>
        <Collapse in={expanded.roster}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel htmlFor="roster-num-qb"> QB</InputLabel>
                <OutlinedInput
                  id="roster-num-qb"
                  value={rosterSettings.roster_num_qb}
                  onChange={(e) =>
                    setRosterSettings({
                      ...rosterSettings,
                      roster_num_qb: e.target.value,
                    })
                  }
                  label=" QB"
                />
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel htmlFor="roster-num-rb"> RB</InputLabel>
                <OutlinedInput
                  id="roster-num-rb"
                  value={rosterSettings.roster_num_rb}
                  onChange={(e) =>
                    setRosterSettings({
                      ...rosterSettings,
                      roster_num_rb: e.target.value,
                    })
                  }
                  label=" RB"
                />
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel htmlFor="roster-num-wr"> WR</InputLabel>
                <OutlinedInput
                  id="roster-num-wr"
                  value={rosterSettings.roster_num_wr}
                  onChange={(e) =>
                    setRosterSettings({
                      ...rosterSettings,
                      roster_num_wr: e.target.value,
                    })
                  }
                  label=" WR"
                />
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel htmlFor="roster-num-te"> TE</InputLabel>
                <OutlinedInput
                  id="roster-num-te"
                  value={rosterSettings.roster_num_te}
                  onChange={(e) =>
                    setRosterSettings({
                      ...rosterSettings,
                      roster_num_te: e.target.value,
                    })
                  }
                  label=" TE"
                />
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel htmlFor="roster-num-flex-wr-rb-te">
                  {" "}
                  Flex WR/RB/TE
                </InputLabel>
                <OutlinedInput
                  id="roster-num-flex-wr-rb-te"
                  value={rosterSettings.roster_num_flex_wr_rb_te}
                  onChange={(e) =>
                    setRosterSettings({
                      ...rosterSettings,
                      roster_num_flex_wr_rb_te: e.target.value,
                    })
                  }
                  label=" Flex WR/RB/TE"
                />
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel htmlFor="roster-num-flex-wr-rb">
                  {" "}
                  Flex WR/RB
                </InputLabel>
                <OutlinedInput
                  id="roster-num-flex-wr-rb"
                  value={rosterSettings.roster_num_flex_wr_rb}
                  onChange={(e) =>
                    setRosterSettings({
                      ...rosterSettings,
                      roster_num_flex_wr_rb: e.target.value,
                    })
                  }
                  label=" Flex WR/RB"
                />
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel htmlFor="roster-num-flex-wr-te">
                  {" "}
                  Flex WR/TE
                </InputLabel>
                <OutlinedInput
                  id="roster-num-flex-wr-te"
                  value={rosterSettings.roster_num_flex_wr_te}
                  onChange={(e) =>
                    setRosterSettings({
                      ...rosterSettings,
                      roster_num_flex_wr_te: e.target.value,
                    })
                  }
                  label=" Flex WR/TE"
                />
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel htmlFor="roster-num-flex-qb-wr-rb-te">
                  {" "}
                  SuperFlex QB/WR/RB/TE
                </InputLabel>
                <OutlinedInput
                  id="roster-num-flex-qb-wr-rb-te"
                  value={rosterSettings.roster_num_flex_qb_wr_rb_te}
                  onChange={(e) =>
                    setRosterSettings({
                      ...rosterSettings,
                      roster_num_flex_qb_wr_rb_te: e.target.value,
                    })
                  }
                  label=" Flex QB/WR/RB/TE"
                />
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel htmlFor="roster-num-k"> K</InputLabel>
                <OutlinedInput
                  id="roster-num-k"
                  value={rosterSettings.roster_num_k}
                  onChange={(e) =>
                    setRosterSettings({
                      ...rosterSettings,
                      roster_num_k: e.target.value,
                    })
                  }
                  label=" K"
                />
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel htmlFor="roster-num-dst"> DST</InputLabel>
                <OutlinedInput
                  id="roster-num-dst"
                  value={rosterSettings.roster_num_dst}
                  onChange={(e) =>
                    setRosterSettings({
                      ...rosterSettings,
                      roster_num_dst: e.target.value,
                    })
                  }
                  label=" DST"
                />
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel htmlFor="roster-num-total-size">
                  Total Roster Size
                </InputLabel>
                <OutlinedInput
                  id="roster-num-total-size"
                  value={rosterSettings.roster_num_total_size}
                  onChange={(e) =>
                    setRosterSettings({
                      ...rosterSettings,
                      roster_num_total_size: e.target.value,
                    })
                  }
                  label="Total Roster Size"
                />
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel htmlFor="roster-max-qb">Max QB</InputLabel>
                <OutlinedInput
                  id="roster-max-qb"
                  value={rosterSettings.roster_max_qb}
                  onChange={(e) =>
                    setRosterSettings({
                      ...rosterSettings,
                      roster_max_qb: e.target.value,
                    })
                  }
                  label="Max QB"
                />
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel htmlFor="roster-max-rb">Max RB</InputLabel>
                <OutlinedInput
                  id="roster-max-rb"
                  value={rosterSettings.roster_max_rb}
                  onChange={(e) =>
                    setRosterSettings({
                      ...rosterSettings,
                      roster_max_rb: e.target.value,
                    })
                  }
                  label="Max RB"
                />
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel htmlFor="roster-max-wr">Max WR</InputLabel>
                <OutlinedInput
                  id="roster-max-wr"
                  value={rosterSettings.roster_max_wr}
                  onChange={(e) =>
                    setRosterSettings({
                      ...rosterSettings,
                      roster_max_wr: e.target.value,
                    })
                  }
                  label="Max WR"
                />
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel htmlFor="roster-max-te">Max TE</InputLabel>
                <OutlinedInput
                  id="roster-max-te"
                  value={rosterSettings.roster_max_te}
                  onChange={(e) =>
                    setRosterSettings({
                      ...rosterSettings,
                      roster_max_te: e.target.value,
                    })
                  }
                  label="Max TE"
                />
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel htmlFor="roster-max-k">Max K</InputLabel>
                <OutlinedInput
                  id="roster-max-k"
                  value={rosterSettings.roster_max_k}
                  onChange={(e) =>
                    setRosterSettings({
                      ...rosterSettings,
                      roster_max_k: e.target.value,
                    })
                  }
                  label="Max K"
                />
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel htmlFor="roster-max-dst">Max DST</InputLabel>
                <OutlinedInput
                  id="roster-max-dst"
                  value={rosterSettings.roster_max_dst}
                  onChange={(e) =>
                    setRosterSettings({
                      ...rosterSettings,
                      roster_max_dst: e.target.value,
                    })
                  }
                  label="Max DST"
                />
              </FormControl>
            </Grid>
          </Grid>
        </Collapse>
      </div>

      <Divider sx={{ margin: "20px 0" }} />

      <div id="passing-scoring-settings">
        <Typography
          variant="h6"
          gutterBottom
          onClick={() => handleExpandClick("passing")}
        >
          Scoring: Passing
          <IconButton size="small" edge="end">
            {expanded.passing ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Typography>
        <Collapse in={expanded.passing}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel htmlFor="scoring-passing-yard">Yard</InputLabel>
                <OutlinedInput
                  id="scoring-passing-yard"
                  value={scoringSettings.scoring_passing_yard}
                  onChange={(e) =>
                    setScoringSettings({
                      ...scoringSettings,
                      scoring_passing_yard: e.target.value,
                    })
                  }
                  label="Passing Yard"
                />
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel htmlFor="scoring-passing-td">TD</InputLabel>
                <OutlinedInput
                  id="scoring-passing-td"
                  value={scoringSettings.scoring_passing_td}
                  onChange={(e) =>
                    setScoringSettings({
                      ...scoringSettings,
                      scoring_passing_td: e.target.value,
                    })
                  }
                  label="Passing TD"
                />
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel htmlFor="scoring-passing-2pt">2PT</InputLabel>
                <OutlinedInput
                  id="scoring-passing-2pt"
                  value={scoringSettings.scoring_passing_2pt}
                  onChange={(e) =>
                    setScoringSettings({
                      ...scoringSettings,
                      scoring_passing_2pt: e.target.value,
                    })
                  }
                  label="Passing 2PT"
                />
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel htmlFor="scoring-passing-interception">
                  Interception
                </InputLabel>
                <OutlinedInput
                  id="scoring-passing-interception"
                  value={scoringSettings.scoring_passing_interception}
                  onChange={(e) =>
                    setScoringSettings({
                      ...scoringSettings,
                      scoring_passing_interception: e.target.value,
                    })
                  }
                  label="Passing Interception"
                />
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel htmlFor="scoring-passing-completion">
                  Completion
                </InputLabel>
                <OutlinedInput
                  id="scoring-passing-completion"
                  value={scoringSettings.scoring_passing_completion}
                  onChange={(e) =>
                    setScoringSettings({
                      ...scoringSettings,
                      scoring_passing_completion: e.target.value,
                    })
                  }
                  label="Passing Completion"
                />
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel htmlFor="scoring-passing-attempt">
                  Attempt
                </InputLabel>
                <OutlinedInput
                  id="scoring-passing-attempt"
                  value={scoringSettings.scoring_passing_attempt}
                  onChange={(e) =>
                    setScoringSettings({
                      ...scoringSettings,
                      scoring_passing_attempt: e.target.value,
                    })
                  }
                  label="Passing Attempt"
                />
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel htmlFor="scoring-passing-sack">Sack</InputLabel>
                <OutlinedInput
                  id="scoring-passing-sack"
                  value={scoringSettings.scoring_passing_sack}
                  onChange={(e) =>
                    setScoringSettings({
                      ...scoringSettings,
                      scoring_passing_sack: e.target.value,
                    })
                  }
                  label="Passing Sack"
                />
              </FormControl>
            </Grid>
          </Grid>
        </Collapse>
      </div>

      <Divider sx={{ margin: "20px 0" }} />

      <div id="rushing-scoring-settings">
        <Typography
          variant="h6"
          gutterBottom
          onClick={() => handleExpandClick("rushing")}
        >
          Scoring: Rushing
          <IconButton size="small" edge="end">
            {expanded.rushing ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Typography>
        <Collapse in={expanded.rushing}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel htmlFor="scoring-rushing-yard">Yard</InputLabel>
                <OutlinedInput
                  id="scoring-rushing-yard"
                  value={scoringSettings.scoring_rushing_yard}
                  onChange={(e) =>
                    setScoringSettings({
                      ...scoringSettings,
                      scoring_rushing_yard: e.target.value,
                    })
                  }
                  label="Rushing Yard"
                />
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel htmlFor="scoring-rushing-td">TD</InputLabel>
                <OutlinedInput
                  id="scoring-rushing-td"
                  value={scoringSettings.scoring_rushing_td}
                  onChange={(e) =>
                    setScoringSettings({
                      ...scoringSettings,
                      scoring_rushing_td: e.target.value,
                    })
                  }
                  label="Rushing TD"
                />
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel htmlFor="scoring-rushing-2pt">2PT</InputLabel>
                <OutlinedInput
                  id="scoring-rushing-2pt"
                  value={scoringSettings.scoring_rushing_2pt}
                  onChange={(e) =>
                    setScoringSettings({
                      ...scoringSettings,
                      scoring_rushing_2pt: e.target.value,
                    })
                  }
                  label="Rushing 2PT"
                />
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel htmlFor="scoring-rushing-attempt">
                  Attempt
                </InputLabel>
                <OutlinedInput
                  id="scoring-rushing-attempt"
                  value={scoringSettings.scoring_rushing_attempt}
                  onChange={(e) =>
                    setScoringSettings({
                      ...scoringSettings,
                      scoring_rushing_attempt: e.target.value,
                    })
                  }
                  label="Rushing Attempt"
                />
              </FormControl>
            </Grid>
          </Grid>
        </Collapse>
      </div>

      <Divider sx={{ margin: "20px 0" }} />

      <div id="receiving-scoring-settings">
        <Typography
          variant="h6"
          gutterBottom
          onClick={() => handleExpandClick("receiving")}
        >
          Scoring: Receiving{" "}
          <IconButton size="small" edge="end">
            {expanded.receiving ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Typography>
        <Collapse in={expanded.receiving}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel htmlFor="scoring-receiving-reception">
                  Reception
                </InputLabel>
                <OutlinedInput
                  id="scoring-receiving-reception"
                  value={scoringSettings.scoring_receiving_reception}
                  onChange={(e) =>
                    setScoringSettings({
                      ...scoringSettings,
                      scoring_receiving_reception: e.target.value,
                    })
                  }
                  label="Receiving Reception"
                />
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel htmlFor="scoring-receiving-yard">Yard</InputLabel>
                <OutlinedInput
                  id="scoring-receiving-yard"
                  value={scoringSettings.scoring_receiving_yard}
                  onChange={(e) =>
                    setScoringSettings({
                      ...scoringSettings,
                      scoring_receiving_yard: e.target.value,
                    })
                  }
                  label="Receiving Yard"
                />
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel htmlFor="scoring-receiving-td">TD</InputLabel>
                <OutlinedInput
                  id="scoring-receiving-td"
                  value={scoringSettings.scoring_receiving_td}
                  onChange={(e) =>
                    setScoringSettings({
                      ...scoringSettings,
                      scoring_receiving_td: e.target.value,
                    })
                  }
                  label="Receiving TD"
                />
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel htmlFor="scoring-receiving-2pt">2PT</InputLabel>
                <OutlinedInput
                  id="scoring-receiving-2pt"
                  value={scoringSettings.scoring_receiving_2pt}
                  onChange={(e) =>
                    setScoringSettings({
                      ...scoringSettings,
                      scoring_receiving_2pt: e.target.value,
                    })
                  }
                  label="Receiving 2PT"
                />
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel htmlFor="scoring-receiving-target">
                  Target
                </InputLabel>
                <OutlinedInput
                  id="scoring-receiving-target"
                  value={scoringSettings.scoring_receiving_target}
                  onChange={(e) =>
                    setScoringSettings({
                      ...scoringSettings,
                      scoring_receiving_target: e.target.value,
                    })
                  }
                  label="Receiving Target"
                />
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel htmlFor="scoring-receiving-reception-bonus-RB">
                  Reception Bonus (RB)
                </InputLabel>
                <OutlinedInput
                  id="scoring-receiving-reception-bonus-RB"
                  value={scoringSettings.scoring_receiving_reception_bonus_RB}
                  onChange={(e) =>
                    setScoringSettings({
                      ...scoringSettings,
                      scoring_receiving_reception_bonus_RB: e.target.value,
                    })
                  }
                  label="Reception Bonus (RB)"
                />
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel htmlFor="scoring-receiving-reception-bonus-WR">
                  Reception Bonus (WR)
                </InputLabel>
                <OutlinedInput
                  id="scoring-receiving-reception-bonus-WR"
                  value={scoringSettings.scoring_receiving_reception_bonus_WR}
                  onChange={(e) =>
                    setScoringSettings({
                      ...scoringSettings,
                      scoring_receiving_reception_bonus_WR: e.target.value,
                    })
                  }
                  label="Reception Bonus (WR)"
                />
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel htmlFor="scoring-receiving-reception-bonus-TE">
                  Reception Bonus (TE)
                </InputLabel>
                <OutlinedInput
                  id="scoring-receiving-reception-bonus-TE"
                  value={scoringSettings.scoring_receiving_reception_bonus_TE}
                  onChange={(e) =>
                    setScoringSettings({
                      ...scoringSettings,
                      scoring_receiving_reception_bonus_TE: e.target.value,
                    })
                  }
                  label="Reception Bonus (TE)"
                />
              </FormControl>
            </Grid>
          </Grid>
        </Collapse>
      </div>

      <Divider sx={{ margin: "20px 0" }} />

      <div id="carrying-scoring-settings">
        <Typography
          variant="h6"
          gutterBottom
          onClick={() => handleExpandClick("carrying")}
        >
          Scoring: Carrying{" "}
          <IconButton size="small" edge="end">
            {expanded.carrying ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Typography>
        <Collapse in={expanded.carrying}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel htmlFor="scoring-carrying-fumble">
                  Fumble
                </InputLabel>
                <OutlinedInput
                  id="scoring-carrying-fumble"
                  value={scoringSettings.scoring_carrying_fumble}
                  onChange={(e) =>
                    setScoringSettings({
                      ...scoringSettings,
                      scoring_carrying_fumble: e.target.value,
                    })
                  }
                  label="Carrying Fumble"
                />
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel htmlFor="scoring-carrying-fumble-lost">
                  Fumble Lost
                </InputLabel>
                <OutlinedInput
                  id="scoring-carrying-fumble-lost"
                  value={scoringSettings.scoring_carrying_fumble_lost}
                  onChange={(e) =>
                    setScoringSettings({
                      ...scoringSettings,
                      scoring_carrying_fumble_lost: e.target.value,
                    })
                  }
                  label="Carrying Fumble Lost"
                />
              </FormControl>
            </Grid>
          </Grid>
        </Collapse>
      </div>

      <Divider sx={{ margin: "20px 0" }} />

      <div id="kicking-scoring-settings">
        <Typography
          variant="h6"
          gutterBottom
          onClick={() => handleExpandClick("kicking")}
        >
          Scoring: Kicking{" "}
          <IconButton size="small" edge="end">
            {expanded.kicking ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Typography>
        <Collapse in={expanded.kicking}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel htmlFor="scoring-kicking-fg-made">
                  FG Made
                </InputLabel>
                <OutlinedInput
                  id="scoring-kicking-fg-made"
                  value={scoringSettings.scoring_kicking_fg_made}
                  onChange={(e) =>
                    setScoringSettings({
                      ...scoringSettings,
                      scoring_kicking_fg_made: e.target.value,
                    })
                  }
                  label="Kicking FG Made"
                />
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel htmlFor="scoring-kicking-fg-miss">
                  FG Miss
                </InputLabel>
                <OutlinedInput
                  id="scoring-kicking-fg-miss"
                  value={scoringSettings.scoring_kicking_fg_miss}
                  onChange={(e) =>
                    setScoringSettings({
                      ...scoringSettings,
                      scoring_kicking_fg_miss: e.target.value,
                    })
                  }
                  label="Kicking FG Miss"
                />
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel htmlFor="scoring-kicking-fg-made-0-19">
                  FG Made 0-19
                </InputLabel>
                <OutlinedInput
                  id="scoring-kicking-fg-made-0-19"
                  value={scoringSettings.scoring_kicking_fg_made_0_19}
                  onChange={(e) =>
                    setScoringSettings({
                      ...scoringSettings,
                      scoring_kicking_fg_made_0_19: e.target.value,
                    })
                  }
                  label="Kicking FG Made 0-19"
                />
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel htmlFor="scoring-kicking-fg-made-20-29">
                  FG Made 20-29
                </InputLabel>
                <OutlinedInput
                  id="scoring-kicking-fg-made-20-29"
                  value={scoringSettings.scoring_kicking_fg_made_20_29}
                  onChange={(e) =>
                    setScoringSettings({
                      ...scoringSettings,
                      scoring_kicking_fg_made_20_29: e.target.value,
                    })
                  }
                  label="Kicking FG Made 20-29"
                />
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel htmlFor="scoring-kicking-fg-made-30-39">
                  FG Made 30-39
                </InputLabel>
                <OutlinedInput
                  id="scoring-kicking-fg-made-30-39"
                  value={scoringSettings.scoring_kicking_fg_made_30_39}
                  onChange={(e) =>
                    setScoringSettings({
                      ...scoringSettings,
                      scoring_kicking_fg_made_30_39: e.target.value,
                    })
                  }
                  label="Kicking FG Made 30-39"
                />
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel htmlFor="scoring-kicking-fg-made-40-49">
                  FG Made 40-49
                </InputLabel>
                <OutlinedInput
                  id="scoring-kicking-fg-made-40-49"
                  value={scoringSettings.scoring_kicking_fg_made_40_49}
                  onChange={(e) =>
                    setScoringSettings({
                      ...scoringSettings,
                      scoring_kicking_fg_made_40_49: e.target.value,
                    })
                  }
                  label="Kicking FG Made 40-49"
                />
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel htmlFor="scoring-kicking-fg-made-50-plus">
                  FG Made 50+
                </InputLabel>
                <OutlinedInput
                  id="scoring-kicking-fg-made-50-plus"
                  value={scoringSettings.scoring_kicking_fg_made_50_plus}
                  onChange={(e) =>
                    setScoringSettings({
                      ...scoringSettings,
                      scoring_kicking_fg_made_50_plus: e.target.value,
                    })
                  }
                  label="Kicking FG Made 50+"
                />
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel htmlFor="scoring-kicking-fg-yard">
                  FG Yard
                </InputLabel>
                <OutlinedInput
                  id="scoring-kicking-fg-yard"
                  value={scoringSettings.scoring_kicking_fg_yard}
                  onChange={(e) =>
                    setScoringSettings({
                      ...scoringSettings,
                      scoring_kicking_fg_yard: e.target.value,
                    })
                  }
                  label="Kicking FG Yard"
                />
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel htmlFor="scoring-kicking-xp-made">
                  XP Made
                </InputLabel>
                <OutlinedInput
                  id="scoring-kicking-xp-made"
                  value={scoringSettings.scoring_kicking_xp_made}
                  onChange={(e) =>
                    setScoringSettings({
                      ...scoringSettings,
                      scoring_kicking_xp_made: e.target.value,
                    })
                  }
                  label="Kicking XP Made"
                />
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel htmlFor="scoring-kicking-xp-miss">
                  XP Miss
                </InputLabel>
                <OutlinedInput
                  id="scoring-kicking-xp-miss"
                  value={scoringSettings.scoring_kicking_xp_miss}
                  onChange={(e) =>
                    setScoringSettings({
                      ...scoringSettings,
                      scoring_kicking_xp_miss: e.target.value,
                    })
                  }
                  label="Kicking XP Miss"
                />
              </FormControl>
            </Grid>
          </Grid>
        </Collapse>
      </div>

      <Divider sx={{ margin: "20px 0" }} />

      <div id="defense-scoring-settings">
        <Typography
          variant="h6"
          gutterBottom
          onClick={() => handleExpandClick("defense")}
        >
          Scoring: Defense/Special Teams{" "}
          <IconButton size="small" edge="end">
            {expanded.defense ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Typography>
        <Collapse in={expanded.defense}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel htmlFor="scoring-dst-td">TD</InputLabel>
                <OutlinedInput
                  id="scoring-dst-td"
                  value={scoringSettings.scoring_dst_td}
                  onChange={(e) =>
                    setScoringSettings({
                      ...scoringSettings,
                      scoring_dst_td: e.target.value,
                    })
                  }
                  label="Defense TD"
                />
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel htmlFor="scoring-dst-pts-allowed-0">
                  Pts Allowed 0
                </InputLabel>
                <OutlinedInput
                  id="scoring-dst-pts-allowed-0"
                  value={scoringSettings.scoring_dst_pts_allowed_0}
                  onChange={(e) =>
                    setScoringSettings({
                      ...scoringSettings,
                      scoring_dst_pts_allowed_0: e.target.value,
                    })
                  }
                  label="Defense Pts Allowed 0"
                />
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel htmlFor="scoring-dst-pts-allowed-1-6">
                  Pts Allowed 1-6
                </InputLabel>
                <OutlinedInput
                  id="scoring-dst-pts-allowed-1-6"
                  value={scoringSettings.scoring_dst_pts_allowed_1_6}
                  onChange={(e) =>
                    setScoringSettings({
                      ...scoringSettings,
                      scoring_dst_pts_allowed_1_6: e.target.value,
                    })
                  }
                  label="Defense Pts Allowed 1-6"
                />
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel htmlFor="scoring-dst-pts-allowed-7-13">
                  Pts Allowed 7-13
                </InputLabel>
                <OutlinedInput
                  id="scoring-dst-pts-allowed-7-13"
                  value={scoringSettings.scoring_dst_pts_allowed_7_13}
                  onChange={(e) =>
                    setScoringSettings({
                      ...scoringSettings,
                      scoring_dst_pts_allowed_7_13: e.target.value,
                    })
                  }
                  label="Defense Pts Allowed 7-13"
                />
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel htmlFor="scoring-dst-pts-allowed-14-20">
                  Pts Allowed 14-20
                </InputLabel>
                <OutlinedInput
                  id="scoring-dst-pts-allowed-14-20"
                  value={scoringSettings.scoring_dst_pts_allowed_14_20}
                  onChange={(e) =>
                    setScoringSettings({
                      ...scoringSettings,
                      scoring_dst_pts_allowed_14_20: e.target.value,
                    })
                  }
                  label="Defense Pts Allowed 14-20"
                />
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel htmlFor="scoring-dst-pts-allowed-21-27">
                  Pts Allowed 21-27
                </InputLabel>
                <OutlinedInput
                  id="scoring-dst-pts-allowed-21-27"
                  value={scoringSettings.scoring_dst_pts_allowed_21_27}
                  onChange={(e) =>
                    setScoringSettings({
                      ...scoringSettings,
                      scoring_dst_pts_allowed_21_27: e.target.value,
                    })
                  }
                  label="Defense Pts Allowed 21-27"
                />
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel htmlFor="scoring-dst-pts-allowed-28-34">
                  Pts Allowed 28-34
                </InputLabel>
                <OutlinedInput
                  id="scoring-dst-pts-allowed-28-34"
                  value={scoringSettings.scoring_dst_pts_allowed_28_34}
                  onChange={(e) =>
                    setScoringSettings({
                      ...scoringSettings,
                      scoring_dst_pts_allowed_28_34: e.target.value,
                    })
                  }
                  label="Defense Pts Allowed 28-34"
                />
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel htmlFor="scoring-dst-pts-allowed-35-plus">
                  Pts Allowed 35+
                </InputLabel>
                <OutlinedInput
                  id="scoring-dst-pts-allowed-35-plus"
                  value={scoringSettings.scoring_dst_pts_allowed_35_plus}
                  onChange={(e) =>
                    setScoringSettings({
                      ...scoringSettings,
                      scoring_dst_pts_allowed_35_plus: e.target.value,
                    })
                  }
                  label="Defense Pts Allowed 35+"
                />
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel htmlFor="scoring-dst-sack">Sack</InputLabel>
                <OutlinedInput
                  id="scoring-dst-sack"
                  value={scoringSettings.scoring_dst_sack}
                  onChange={(e) =>
                    setScoringSettings({
                      ...scoringSettings,
                      scoring_dst_sack: e.target.value,
                    })
                  }
                  label="Defense Sack"
                />
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel htmlFor="scoring-dst-interception">
                  Interception
                </InputLabel>
                <OutlinedInput
                  id="scoring-dst-interception"
                  value={scoringSettings.scoring_dst_interception}
                  onChange={(e) =>
                    setScoringSettings({
                      ...scoringSettings,
                      scoring_dst_interception: e.target.value,
                    })
                  }
                  label="Defense Interception"
                />
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel htmlFor="scoring-dst-fumble-recovery">
                  Fumble Recovery
                </InputLabel>
                <OutlinedInput
                  id="scoring-dst-fumble-recovery"
                  value={scoringSettings.scoring_dst_fumble_recover}
                  onChange={(e) =>
                    setScoringSettings({
                      ...scoringSettings,
                      scoring_dst_fumble_recover: e.target.value,
                    })
                  }
                  label="Defense Fumble Recovery"
                />
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel htmlFor="scoring-dst-safeties">Safety</InputLabel>
                <OutlinedInput
                  id="scoring-dst-safeties"
                  value={scoringSettings.scoring_dst_safety}
                  onChange={(e) =>
                    setScoringSettings({
                      ...scoringSettings,
                      scoring_dst_safety: e.target.value,
                    })
                  }
                  label="Defense Safeties"
                />
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel htmlFor="scoring-special-punt-return-yard">
                  Punt Return Yard
                </InputLabel>
                <OutlinedInput
                  id="scoring-special-punt-return-yard"
                  value={scoringSettings.scoring_special_punt_return_yard}
                  onChange={(e) =>
                    setScoringSettings({
                      ...scoringSettings,
                      scoring_special_punt_return_yard: e.target.value,
                    })
                  }
                  label="Special Punt Return Yard"
                />
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel htmlFor="scoring-special-punt-return-td">
                  Punt Return TD
                </InputLabel>
                <OutlinedInput
                  id="scoring-special-punt-return-td"
                  value={scoringSettings.scoring_special_punt_return_td}
                  onChange={(e) =>
                    setScoringSettings({
                      ...scoringSettings,
                      scoring_special_punt_return_td: e.target.value,
                    })
                  }
                  label="Special Punt Return TD"
                />
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel htmlFor="scoring-special-kick-return-yard">
                  Kick Return Yard
                </InputLabel>
                <OutlinedInput
                  id="scoring-special-kick-return-yard"
                  value={scoringSettings.scoring_special_kick_return_yard}
                  onChange={(e) =>
                    setScoringSettings({
                      ...scoringSettings,
                      scoring_special_kick_return_yard: e.target.value,
                    })
                  }
                  label="Special Kick Return Yard"
                />
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel htmlFor="scoring-special-kick-return-td">
                  Kick Return TD
                </InputLabel>
                <OutlinedInput
                  id="scoring-special-kick-return-td"
                  value={scoringSettings.scoring_special_kick_return_td}
                  onChange={(e) =>
                    setScoringSettings({
                      ...scoringSettings,
                      scoring_special_kick_return_td: e.target.value,
                    })
                  }
                  label="Special Kick Return TD"
                />
              </FormControl>
            </Grid>
          </Grid>
        </Collapse>
      </div>

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
