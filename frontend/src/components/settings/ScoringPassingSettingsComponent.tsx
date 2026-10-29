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

interface ScoringPassingSettingsProps {
  scoringSettings: any;
  setScoringSettings: (settings: any) => void;
  expanded: boolean;
  handleExpandClick: () => void;
}

const ScoringPassingSettingsComponent: React.FC<ScoringPassingSettingsProps> = ({
  scoringSettings,
  setScoringSettings,
  expanded,
  handleExpandClick,
}) => {
  return (
    <div id="passing-scoring-settings">
      <Typography variant="h6" gutterBottom onClick={handleExpandClick}>
        Scoring: Passing
        <IconButton size="small" edge="end">
          {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Typography>
      <Collapse in={expanded}>
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
              <InputLabel htmlFor="scoring-passing-interception">Interception</InputLabel>
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
              <InputLabel htmlFor="scoring-passing-completion">Completion</InputLabel>
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
              <InputLabel htmlFor="scoring-passing-attempt">Attempt</InputLabel>
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
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth margin="normal">
              <InputLabel htmlFor="scoring-passing-bonus-300-yards">
                300+ Yard Game Bonus
              </InputLabel>
              <OutlinedInput
                id="scoring-passing-bonus-300-yards"
                value={scoringSettings.scoring_passing_bonus_300_yards}
                onChange={(e) =>
                  setScoringSettings({
                    ...scoringSettings,
                    scoring_passing_bonus_300_yards: e.target.value,
                  })
                }
                label="300+ Yard Game Bonus"
              />
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth margin="normal">
              <InputLabel htmlFor="scoring-passing-bonus-400-yards">
                400+ Yard Game Bonus
              </InputLabel>
              <OutlinedInput
                id="scoring-passing-bonus-400-yards"
                value={scoringSettings.scoring_passing_bonus_400_yards}
                onChange={(e) =>
                  setScoringSettings({
                    ...scoringSettings,
                    scoring_passing_bonus_400_yards: e.target.value,
                  })
                }
                label="400+ Yard Game Bonus"
              />
            </FormControl>
          </Grid>
        </Grid>
      </Collapse>
    </div>
  );
};

export default ScoringPassingSettingsComponent;
