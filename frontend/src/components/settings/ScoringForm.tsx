import { Box, Typography } from "@mui/material";
import { SCORING_GROUPS } from "../../settings/scoringGroups";
import type { SettingsValues } from "../../settings/types";
import SettingsSection from "./SettingsSection";

interface ScoringFormProps {
  values: SettingsValues;
  onChange: (key: string, rawValue: string) => void;
  disabled?: boolean;
}

const ScoringForm = ({ values, onChange, disabled }: ScoringFormProps) => (
  <Box>
    <Typography variant="h6" sx={{ mb: 1 }}>
      Scoring
    </Typography>
    {SCORING_GROUPS.map((group, index) => (
      <SettingsSection
        key={group.id}
        group={group}
        values={values}
        onChange={onChange}
        disabled={disabled}
        defaultExpanded={index === 0}
      />
    ))}
  </Box>
);

export default ScoringForm;
