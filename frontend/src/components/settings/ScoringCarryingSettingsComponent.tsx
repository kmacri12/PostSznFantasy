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

interface ScoringCarryingSettingsProps {
  scoringSettings: any;
  setScoringSettings: (settings: any) => void;
  expanded: boolean;
  handleExpandClick: () => void;
}

const ScoringCarryingSettingsComponent: React.FC<
  ScoringCarryingSettingsProps
> = ({ scoringSettings, setScoringSettings, expanded, handleExpandClick }) => {
  return (
    <div id="carrying-scoring-settings">
      <Typography variant="h6" gutterBottom onClick={handleExpandClick}>
        Scoring: Carrying{" "}
        <IconButton size="small" edge="end">
          {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Typography>
      <Collapse in={expanded}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth margin="normal">
              <InputLabel htmlFor="scoring-carrying-fumble">Fumble</InputLabel>
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
  );
};

export default ScoringCarryingSettingsComponent;
