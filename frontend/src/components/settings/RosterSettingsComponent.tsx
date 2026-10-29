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

interface RosterSettingsProps {
  rosterSettings: {
    number_teams: number;
    roster_total: number;
    roster_num_qb: number;
    roster_num_rb: number;
    roster_num_wr: number;
    roster_num_te: number;
    roster_num_flex_wr_rb_te: number;
    roster_num_flex_wr_rb: number;
    roster_num_flex_wr_te: number;
    roster_num_flex_qb_wr_rb_te: number;
    roster_num_k: number;
    roster_num_dst: number;
    roster_num_bench: number;
    roster_max_qb: number;
    roster_max_rb: number;
    roster_max_wr: number;
    roster_max_te: number;
    roster_max_k: number;
    roster_max_dst: number;
  };
  setRosterSettings: (settings: any) => void;
  expanded: boolean;
  handleExpandClick: () => void;
}

const RosterSettingsComponent: React.FC<RosterSettingsProps> = ({
  rosterSettings,
  setRosterSettings,
  expanded,
  handleExpandClick,
}) => {
  const calculateRosterTotal = (settings: any) => {
    return (
      settings.roster_num_qb +
      settings.roster_num_rb +
      settings.roster_num_wr +
      settings.roster_num_te +
      settings.roster_num_flex_wr_rb_te +
      settings.roster_num_flex_wr_rb +
      settings.roster_num_flex_wr_te +
      settings.roster_num_flex_qb_wr_rb_te +
      settings.roster_num_k +
      settings.roster_num_dst +
      settings.roster_num_bench
    );
  };

  const handleInputChange = (field: string) => (e: { target: { value: string } }) => {
    const updatedSettings = {
      ...rosterSettings,
      [field]: Number.parseInt(e.target.value, 10),
    };
    const newTotal = calculateRosterTotal(updatedSettings);
    updatedSettings.roster_total = newTotal;
    setRosterSettings(updatedSettings);
  };

  return (
    <div id="roster-settings">
      <Typography variant="h6" gutterBottom onClick={handleExpandClick}>
        Roster Settings{" "}
        <IconButton size="small" edge="end">
          {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Typography>
      <Collapse in={expanded}>
        <Typography variant="body1">Roster Total: {rosterSettings.roster_total}</Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth margin="normal">
              <InputLabel htmlFor="roster-num-qb">QB</InputLabel>
              <OutlinedInput
                id="roster-num-qb"
                type="number"
                value={rosterSettings.roster_num_qb || ""}
                onChange={handleInputChange("roster_num_qb")}
                label="QB"
              />
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth margin="normal">
              <InputLabel htmlFor="roster-num-rb">RB</InputLabel>
              <OutlinedInput
                id="roster-num-rb"
                type="number"
                value={rosterSettings.roster_num_rb || ""}
                onChange={handleInputChange("roster_num_rb")}
                label="RB"
              />
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth margin="normal">
              <InputLabel htmlFor="roster-num-wr">WR</InputLabel>
              <OutlinedInput
                id="roster-num-wr"
                type="number"
                value={rosterSettings.roster_num_wr || ""}
                onChange={handleInputChange("roster_num_wr")}
                label="WR"
              />
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth margin="normal">
              <InputLabel htmlFor="roster-num-te">TE</InputLabel>
              <OutlinedInput
                id="roster-num-te"
                type="number"
                value={rosterSettings.roster_num_te || ""}
                onChange={handleInputChange("roster_num_te")}
                label="TE"
              />
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth margin="normal">
              <InputLabel htmlFor="roster-num-flex-wr-rb-te">Flex WR/RB/TE</InputLabel>
              <OutlinedInput
                id="roster-num-flex-wr-rb-te"
                type="number"
                value={rosterSettings.roster_num_flex_wr_rb_te || ""}
                onChange={handleInputChange("roster_num_flex_wr_rb_te")}
                label="Flex WR/RB/TE"
              />
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth margin="normal">
              <InputLabel htmlFor="roster-num-flex-wr-rb">Flex WR/RB</InputLabel>
              <OutlinedInput
                id="roster-num-flex-wr-rb"
                type="number"
                value={rosterSettings.roster_num_flex_wr_rb || ""}
                onChange={handleInputChange("roster_num_flex_wr_rb")}
                label="Flex WR/RB"
              />
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth margin="normal">
              <InputLabel htmlFor="roster-num-flex-wr-te">Flex WR/TE</InputLabel>
              <OutlinedInput
                id="roster-num-flex-wr-te"
                type="number"
                value={rosterSettings.roster_num_flex_wr_te || ""}
                onChange={handleInputChange("roster_num_flex_wr_te")}
                label="Flex WR/TE"
              />
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth margin="normal">
              <InputLabel htmlFor="roster-num-flex-qb-wr-rb-te">SuperFlex QB/WR/RB/TE</InputLabel>
              <OutlinedInput
                id="roster-num-flex-qb-wr-rb-te"
                type="number"
                value={rosterSettings.roster_num_flex_qb_wr_rb_te || ""}
                onChange={handleInputChange("roster_num_flex_qb_wr_rb_te")}
                label="SuperFlex QB/WR/RB/TE"
              />
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth margin="normal">
              <InputLabel htmlFor="roster-num-k">K</InputLabel>
              <OutlinedInput
                id="roster-num-k"
                type="number"
                value={rosterSettings.roster_num_k || ""}
                onChange={handleInputChange("roster_num_k")}
                label="K"
              />
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth margin="normal">
              <InputLabel htmlFor="roster-num-dst">DST</InputLabel>
              <OutlinedInput
                id="roster-num-dst"
                type="number"
                value={rosterSettings.roster_num_dst || ""}
                onChange={handleInputChange("roster_num_dst")}
                label="DST"
              />
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth margin="normal">
              <InputLabel htmlFor="roster-num-bench">Bench</InputLabel>
              <OutlinedInput
                id="roster-num-bench"
                type="number"
                value={rosterSettings.roster_num_bench || ""}
                onChange={handleInputChange("roster_num_bench")}
                label="Bench Size"
              />
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth margin="normal">
              <InputLabel htmlFor="roster-max-qb">Max QB</InputLabel>
              <OutlinedInput
                id="roster-max-qb"
                type="number"
                value={rosterSettings.roster_max_qb || ""}
                onChange={handleInputChange("roster_max_qb")}
                label="Max QB"
              />
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth margin="normal">
              <InputLabel htmlFor="roster-max-rb">Max RB</InputLabel>
              <OutlinedInput
                id="roster-max-rb"
                type="number"
                value={rosterSettings.roster_max_rb || ""}
                onChange={handleInputChange("roster_max_rb")}
                label="Max RB"
              />
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth margin="normal">
              <InputLabel htmlFor="roster-max-wr">Max WR</InputLabel>
              <OutlinedInput
                id="roster-max-wr"
                type="number"
                value={rosterSettings.roster_max_wr || ""}
                onChange={handleInputChange("roster_max_wr")}
                label="Max WR"
              />
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth margin="normal">
              <InputLabel htmlFor="roster-max-te">Max TE</InputLabel>
              <OutlinedInput
                id="roster-max-te"
                type="number"
                value={rosterSettings.roster_max_te || ""}
                onChange={handleInputChange("roster_max_te")}
                label="Max TE"
              />
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth margin="normal">
              <InputLabel htmlFor="roster-max-k">Max K</InputLabel>
              <OutlinedInput
                id="roster-max-k"
                type="number"
                value={rosterSettings.roster_max_k || ""}
                onChange={handleInputChange("roster_max_k")}
                label="Max K"
              />
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth margin="normal">
              <InputLabel htmlFor="roster-max-dst">Max DST</InputLabel>
              <OutlinedInput
                id="roster-max-dst"
                type="number"
                value={rosterSettings.roster_max_dst || ""}
                onChange={handleInputChange("roster_max_dst")}
                label="Max DST"
              />
            </FormControl>
          </Grid>
        </Grid>
      </Collapse>
    </div>
  );
};

export default RosterSettingsComponent;
