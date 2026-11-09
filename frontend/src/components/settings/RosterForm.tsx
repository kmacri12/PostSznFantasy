import { Box, Typography } from "@mui/material";
import { SETTING_HELP } from "../../content/rules";
import { ROSTER_GROUPS, STARTER_AND_BENCH_KEYS, sumRosterSpots } from "../../settings/rosterGroups";
import type { SettingsValues } from "../../settings/types";
import SettingsSection from "./SettingsSection";

interface RosterFormProps {
  values: SettingsValues;
  onChange: (values: SettingsValues) => void;
  disabled?: boolean;
  errors?: Record<string, string>;
}

/** Keeps roster_total equal to starters + bench whenever one of them changes. */
const RosterForm = ({ values, onChange, disabled, errors }: RosterFormProps) => {
  const handleChange = (key: string, rawValue: string) => {
    const next = { ...values, [key]: rawValue };
    if (STARTER_AND_BENCH_KEYS.includes(key)) next.roster_total = sumRosterSpots(next);
    onChange(next);
  };

  return (
    <Box>
      {ROSTER_GROUPS.map((group, index) => (
        <SettingsSection
          key={group.id}
          group={group}
          values={values}
          onChange={handleChange}
          disabled={disabled}
          errors={errors}
          inputMode="numeric"
          defaultExpanded={index === 0}
          help={
            group.id === "limits"
              ? SETTING_HELP.rosterLimits
              : `${SETTING_HELP.rosterStarters} ${SETTING_HELP.rosterBench}`
          }
        />
      ))}
      <Typography color="text.secondary" sx={{ mt: 1 }}>
        Roster size: {values.roster_total}
      </Typography>
    </Box>
  );
};

export default RosterForm;
