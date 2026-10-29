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

interface ScoringSpecialTeamsSettingsProps {
  scoringSettings: any;
  setScoringSettings: (settings: any) => void;
  expanded: boolean;
  handleExpandClick: () => void;
}

const ScoringSpecialTeamsSettingsComponent: React.FC<ScoringSpecialTeamsSettingsProps> = ({
  scoringSettings,
  setScoringSettings,
  expanded,
  handleExpandClick,
}) => {
  return (
    <div id="special-teams-scoring-settings">
      <Typography variant="h6" gutterBottom onClick={handleExpandClick}>
        Scoring: Special Teams{" "}
        <IconButton size="small" edge="end">
          {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Typography>
      <Collapse in={expanded}>
        <Grid container spacing={2}>
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

export default ScoringSpecialTeamsSettingsComponent;
