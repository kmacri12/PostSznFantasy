import { Box } from "@mui/material";
import { SCORING_GROUPS } from "../../settings/scoringGroups";
import { scoringHelp } from "../../settings/scoringHelp";
import type { SettingsValues } from "../../settings/types";
import SettingsSection from "./SettingsSection";

interface ScoringFormProps {
  values: SettingsValues;
  onChange: (key: string, rawValue: string) => void;
  disabled?: boolean;
}

const ScoringForm = ({ values, onChange, disabled }: ScoringFormProps) => (
  <Box>
    {SCORING_GROUPS.map((group, index) => (
      <SettingsSection
        key={group.id}
        group={group}
        values={values}
        onChange={onChange}
        disabled={disabled}
        defaultExpanded={index === 0}
        helper={scoringHelp}
      />
    ))}
  </Box>
);

export default ScoringForm;
