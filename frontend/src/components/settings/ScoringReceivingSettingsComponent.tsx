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

interface ScoringReceivingSettingsProps {
  scoringSettings: any;
  setScoringSettings: (settings: any) => void;
  expanded: boolean;
  handleExpandClick: () => void;
}

const ScoringReceivingSettingsComponent: React.FC<ScoringReceivingSettingsProps> = ({
  scoringSettings,
  setScoringSettings,
  expanded,
  handleExpandClick,
}) => {
  return (
    <div id="receiving-scoring-settings">
      <Typography variant="h6" gutterBottom onClick={handleExpandClick}>
        Scoring: Receiving{" "}
        <IconButton size="small" edge="end">
          {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Typography>
      <Collapse in={expanded}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth margin="normal">
              <InputLabel htmlFor="scoring-receiving-reception">Reception</InputLabel>
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
              <InputLabel htmlFor="scoring-receiving-target">Target</InputLabel>
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
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth margin="normal">
              <InputLabel htmlFor="scoring-receiving-bonus-100-yards">
                100+ Yard Game Bonus
              </InputLabel>
              <OutlinedInput
                id="scoring-receiving-bonus-100-yards"
                value={scoringSettings.scoring_receiving_bonus_100_yards}
                onChange={(e) =>
                  setScoringSettings({
                    ...scoringSettings,
                    scoring_receiving_bonus_100_yards: e.target.value,
                  })
                }
                label="100+ Yard Game Bonus"
              />
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth margin="normal">
              <InputLabel htmlFor="scoring-receiving-bonus-200-yards">
                200+ Yard Game Bonus
              </InputLabel>
              <OutlinedInput
                id="scoring-receiving-bonus-200-yards"
                value={scoringSettings.scoring_receiving_bonus_200_yards}
                onChange={(e) =>
                  setScoringSettings({
                    ...scoringSettings,
                    scoring_receiving_bonus_200_yards: e.target.value,
                  })
                }
                label="200+ Yard Game Bonus"
              />
            </FormControl>
          </Grid>
        </Grid>
      </Collapse>
    </div>
  );
};

export default ScoringReceivingSettingsComponent;
