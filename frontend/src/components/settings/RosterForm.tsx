import { Box, Typography } from "@mui/material";
import { SETTING_HELP } from "../../content/rules";
import { ROSTER_GROUPS, STARTER_AND_BENCH_KEYS, sumRosterSpots } from "../../settings/rosterGroups";
import type { SettingGroup, SettingsValues } from "../../settings/types";
import { formatLimit } from "../../utils/positionLimit";
import SettingsSection from "./SettingsSection";

interface RosterFormProps {
  values: SettingsValues;
  onChange: (values: SettingsValues) => void;
  disabled?: boolean;
  /** Shown first in the locked summary, e.g. "Locked since the draft started." */
  lockedNote?: string;
  errors?: Record<string, string>;
}

/** "1 QB · 2 RB · 8 bench": empty positions left out, so the line stays one or two rows. */
const summaryLine = (group: SettingGroup, values: SettingsValues): string =>
  group.fields
    .filter((field) => Number(values[field.key]) > 0)
    .map((field) => {
      const label = field.label.replace(/^Max /, "");
      if (field.limit) return `${label}: ${formatLimit(values[field.key] ?? "")}`;
      return `${values[field.key]} ${label === "Bench" ? "bench" : label}`;
    })
    .join("\n") || "None";

/** Keeps roster_total equal to starters + bench whenever one of them changes. */
const RosterForm = ({ values, onChange, disabled, lockedNote, errors }: RosterFormProps) => {
  const handleChange = (key: string, rawValue: string) => {
    const next = { ...values, [key]: rawValue };
    if (STARTER_AND_BENCH_KEYS.includes(key)) next.roster_total = sumRosterSpots(next);
    onChange(next);
  };

  if (disabled) {
    return (
      <Box>
        {lockedNote && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {lockedNote}
          </Typography>
        )}
        {ROSTER_GROUPS.map((group) => (
          <Typography key={group.id} sx={{ mb: 0.5, whiteSpace: "pre-line" }}>
            <strong>{group.id === "limits" ? "Limits" : group.title}:</strong>
            {"\n"}
            {summaryLine(group, values)}
          </Typography>
        ))}
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          Roster size: {values.roster_total}
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {ROSTER_GROUPS.map((group) => (
        <SettingsSection
          key={group.id}
          group={group}
          values={values}
          onChange={handleChange}
          disabled={disabled}
          errors={errors}
          inputMode="numeric"
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
