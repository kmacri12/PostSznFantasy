import {
  Box,
  FormControl,
  FormControlLabel,
  FormHelperText,
  FormLabel,
  Radio,
  RadioGroup,
} from "@mui/material";
import { TEAM_K_HELP, TEAM_QB_HELP } from "../../settings/postseasonFields";
import HelpTip from "../common/HelpTip";

export interface TeamUnitValues {
  team_qb: boolean | null;
  team_k: boolean | null;
}

const CHOICES = [
  { key: "team_qb", label: "Team QB", noun: "QB", help: TEAM_QB_HELP },
  { key: "team_k", label: "Team K", noun: "K", help: TEAM_K_HELP },
] as const;

interface Props {
  values: TeamUnitValues;
  onChange: (key: keyof TeamUnitValues, value: boolean) => void;
}

/** No option starts selected: each is the commissioner's explicit choice. */
const TeamUnitChoice = ({ values, onChange }: Props) => (
  <Box sx={{ display: "grid", gap: 2, mb: 2 }}>
    {CHOICES.map(({ key, label, noun, help }) => {
      const id = `${key.replaceAll("_", "-")}-label`;
      const chosen = values[key];
      return (
        <FormControl key={key} required>
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <FormLabel id={id}>{label}</FormLabel>
            <HelpTip label={label} text={help} />
          </Box>
          <RadioGroup
            aria-labelledby={id}
            value={chosen === null ? "" : String(chosen)}
            onChange={(event) => onChange(key, event.target.value === "true")}
          >
            <FormControlLabel
              value="true"
              control={<Radio />}
              label={`On: scores every ${noun} on his NFL team`}
              sx={{ minHeight: 44 }}
            />
            <FormControlLabel
              value="false"
              control={<Radio />}
              label="Off: scores only himself"
              sx={{ minHeight: 44 }}
            />
          </RadioGroup>
          {chosen === null && <FormHelperText>Choose one to continue</FormHelperText>}
        </FormControl>
      );
    })}
  </Box>
);

export default TeamUnitChoice;
