import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import {
  Box,
  FormControl,
  FormControlLabel,
  FormHelperText,
  FormLabel,
  IconButton,
  Radio,
  RadioGroup,
  Tooltip,
} from "@mui/material";
import { TEAM_K_HELP, TEAM_QB_HELP } from "../../settings/postseasonFields";

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
            <Tooltip title={help} arrow enterTouchDelay={0} leaveTouchDelay={6000}>
              <IconButton aria-label={`About ${label}`} sx={{ width: 44, height: 44 }}>
                <InfoOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
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
