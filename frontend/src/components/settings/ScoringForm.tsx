import { Box } from "@mui/material";
import { SETTING_HELP } from "../../content/rules";
import { SCORING_GROUPS } from "../../settings/scoringGroups";
import { scoringHelp } from "../../settings/scoringHelp";
import type { SettingsValues } from "../../settings/types";
import SettingsSection from "./SettingsSection";

interface ScoringFormProps {
  values: SettingsValues;
  onChange: (key: string, rawValue: string) => void;
  disabled?: boolean;
  errors?: Record<string, string>;
}

const ScoringForm = ({ values, onChange, disabled, errors }: ScoringFormProps) => (
  <Box>
    {SCORING_GROUPS.map((group, index) => (
      <SettingsSection
        key={group.id}
        group={group}
        values={values}
        onChange={onChange}
        disabled={disabled}
        errors={errors}
        defaultExpanded={index === 0}
        helper={scoringHelp}
        help={SETTING_HELP.scoring}
      />
    ))}
  </Box>
);

export default ScoringForm;
