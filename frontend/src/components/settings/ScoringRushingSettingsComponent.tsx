import {
  Typography,
  IconButton,
  Collapse,
  Grid,
  FormControl,
  InputLabel,
  OutlinedInput,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import React from "react";

interface ScoringRushingSettingsProps {
  scoringSettings: any;
  setScoringSettings: (settings: any) => void;
  expanded: boolean;
  handleExpandClick: () => void;
}

const ScoringRushingSettingsComponent: React.FC<
  ScoringRushingSettingsProps
> = ({ scoringSettings, setScoringSettings, expanded, handleExpandClick }) => {
  return (
    <div id="rushing-scoring-settings">
      <Typography variant="h6" gutterBottom onClick={handleExpandClick}>
        Scoring: Rushing
        <IconButton size="small" edge="end">
          {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Typography>
      <Collapse in={expanded}>
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
              <InputLabel htmlFor="scoring-rushing-attempt">Attempt</InputLabel>
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
  );
};

export default ScoringRushingSettingsComponent;
