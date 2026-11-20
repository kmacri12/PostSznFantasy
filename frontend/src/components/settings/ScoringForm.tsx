import { Box } from "@mui/material";
import { SCORING_GROUPS } from "../../settings/scoringGroups";
import type { SettingsValues } from "../../settings/types";
import SettingsSection from "./SettingsSection";

interface ScoringFormProps {
  values: SettingsValues;
  onChange: (key: string, rawValue: string) => void;
  disabled?: boolean;
  errors?: Record<string, string>;
  defaults?: SettingsValues;
}

const ScoringForm = ({ values, onChange, disabled, errors, defaults }: ScoringFormProps) => (
  <Box>
    {SCORING_GROUPS.map((group) => (
      <SettingsSection
        key={group.id}
        group={group}
        values={values}
        onChange={onChange}
        disabled={disabled}
        errors={errors}
        defaults={defaults}
      />
    ))}
  </Box>
);

export default ScoringForm;
