import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Collapse,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  OutlinedInput,
  Typography,
} from "@mui/material";
import type React from "react";

interface ScoringDSTSettingsProps {
  scoringSettings: any;
  setScoringSettings: (settings: any) => void;
  expanded: boolean;
  handleExpandClick: () => void;
}

const ScoringDSTSettingsComponent: React.FC<ScoringDSTSettingsProps> = ({
  scoringSettings,
  setScoringSettings,
  expanded,
  handleExpandClick,
}) => {
  return (
    <div id="defense-scoring-settings">
      <Typography variant="h6" gutterBottom onClick={handleExpandClick}>
        Scoring: Defense/Special Teams{" "}
        <IconButton size="small" edge="end">
          {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Typography>
      <Collapse in={expanded}>
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
              <InputLabel htmlFor="scoring-dst-pts-allowed-0">Pts Allowed 0</InputLabel>
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
              <InputLabel htmlFor="scoring-dst-pts-allowed-1-6">Pts Allowed 1-6</InputLabel>
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
              <InputLabel htmlFor="scoring-dst-pts-allowed-7-13">Pts Allowed 7-13</InputLabel>
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
              <InputLabel htmlFor="scoring-dst-pts-allowed-14-20">Pts Allowed 14-20</InputLabel>
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
              <InputLabel htmlFor="scoring-dst-pts-allowed-21-27">Pts Allowed 21-27</InputLabel>
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
              <InputLabel htmlFor="scoring-dst-pts-allowed-28-34">Pts Allowed 28-34</InputLabel>
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
              <InputLabel htmlFor="scoring-dst-pts-allowed-35-plus">Pts Allowed 35+</InputLabel>
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
              <InputLabel htmlFor="scoring-dst-interception">Interception</InputLabel>
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
              <InputLabel htmlFor="scoring-dst-fumble-recovery">Fumble Recovery</InputLabel>
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
              <InputLabel htmlFor="scoring-special-punt-return-yard">Punt Return Yard</InputLabel>
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
              <InputLabel htmlFor="scoring-special-punt-return-td">Punt Return TD</InputLabel>
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
              <InputLabel htmlFor="scoring-special-kick-return-yard">Kick Return Yard</InputLabel>
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
              <InputLabel htmlFor="scoring-special-kick-return-td">Kick Return TD</InputLabel>
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
  );
};

export default ScoringDSTSettingsComponent;
