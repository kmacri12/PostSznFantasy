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

interface ScoringKickingSettingsProps {
  scoringSettings: any;
  setScoringSettings: (settings: any) => void;
  expanded: boolean;
  handleExpandClick: () => void;
}

const ScoringKickingSettingsComponent: React.FC<
  ScoringKickingSettingsProps
> = ({ scoringSettings, setScoringSettings, expanded, handleExpandClick }) => {
  return (
    <div id="kicking-scoring-settings">
      <Typography variant="h6" gutterBottom onClick={handleExpandClick}>
        Scoring: Kicking{" "}
        <IconButton size="small" edge="end">
          {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Typography>
      <Collapse in={expanded}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth margin="normal">
              <InputLabel htmlFor="scoring-kicking-fg-made">FG Made</InputLabel>
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
              <InputLabel htmlFor="scoring-kicking-fg-miss">FG Miss</InputLabel>
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
              <InputLabel htmlFor="scoring-kicking-fg-yard">FG Yard</InputLabel>
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
              <InputLabel htmlFor="scoring-kicking-xp-made">XP Made</InputLabel>
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
              <InputLabel htmlFor="scoring-kicking-xp-miss">XP Miss</InputLabel>
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
  );
};

export default ScoringKickingSettingsComponent;
