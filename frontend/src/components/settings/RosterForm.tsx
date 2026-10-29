import { Box, Typography } from "@mui/material";
import { ROSTER_GROUPS, STARTER_AND_BENCH_KEYS, sumRosterSpots } from "../../settings/rosterGroups";
import type { SettingsValues } from "../../settings/types";
import SettingsSection from "./SettingsSection";

interface RosterFormProps {
  values: SettingsValues;
  onChange: (values: SettingsValues) => void;
  disabled?: boolean;
}

/** Keeps roster_total equal to starters + bench whenever one of them changes. */
const RosterForm = ({ values, onChange, disabled }: RosterFormProps) => {
  const handleChange = (key: string, rawValue: string) => {
    const next = { ...values, [key]: Number.parseInt(rawValue, 10) || 0 };
    if (STARTER_AND_BENCH_KEYS.includes(key)) next.roster_total = sumRosterSpots(next);
    onChange(next);
  };

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 1 }}>
        Roster
      </Typography>
      {ROSTER_GROUPS.map((group, index) => (
        <SettingsSection
          key={group.id}
          group={group}
          values={values}
          onChange={handleChange}
          disabled={disabled}
          defaultExpanded={index === 0}
        />
      ))}
      <Typography color="text.secondary" sx={{ mt: 1 }}>
        Roster size: {values.roster_total}
      </Typography>
    </Box>
  );
};

export default RosterForm;
