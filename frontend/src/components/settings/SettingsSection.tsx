import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  FormHelperText,
  OutlinedInput,
  Typography,
} from "@mui/material";
import { useState } from "react";
import type { SettingGroup, SettingsValues } from "../../settings/types";
import HelpTip from "../common/HelpTip";

interface SettingsSectionProps {
  group: SettingGroup;
  values: SettingsValues;
  onChange: (key: string, rawValue: string) => void;
  title?: string;
  defaultExpanded?: boolean;
  /** Shown as plain text, not editable (non-commissioners, or locked once the draft starts). */
  disabled?: boolean;
  inputMode?: "decimal" | "numeric";
  /** Plain-language note on the whole block, opened from an info button. */
  help?: string;
  /** Problems by field key; shown under a field once it has been left (blurred). */
  errors?: Record<string, string>;
  /** Optional explanation shown under an input, e.g. "1 point per 25 yards". */
  helper?: (key: string, rawValue: string | number) => string | null;
}

/** "Yard 0.04 · TD 4": the fields that score, so a collapsed block says what is in it. */
export const groupSummary = (group: SettingGroup, values: SettingsValues): string =>
  group.fields
    .filter((field) => values[field.key] !== undefined && Number(values[field.key]) !== 0)
    .map((field) => `${field.label} ${values[field.key]}`)
    .join("\n") || "Nothing scored";

/** One collapsible block of numeric rows (label left, small field right), generated from a field schema. */
const SettingsSection = ({
  group,
  values,
  onChange,
  title,
  defaultExpanded = false,
  disabled = false,
  inputMode = "decimal",
  helper,
  help,
  errors,
}: SettingsSectionProps) => {
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const heading = title ?? group.title;
  if (disabled) {
    return (
      <Typography sx={{ mb: 0.75, whiteSpace: "pre-line" }}>
        <strong>{heading}:</strong>
        {"\n"}
        {groupSummary(group, values)}
      </Typography>
    );
  }
  return (
    <Accordion defaultExpanded={defaultExpanded} disableGutters>
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        sx={{ "& .MuiAccordionSummary-content": { minWidth: 0 } }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {heading}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-line" }}>
            {groupSummary(group, values)}
          </Typography>
        </Box>
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0 }}>
        {help && (
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <Typography variant="body2" color="text.secondary">
              What do these mean?
            </Typography>
            <HelpTip label={heading} text={help} />
          </Box>
        )}
        {group.fields.map((field) => {
          const id = field.key.replaceAll("_", "-");
          const problem = touched.has(field.key) ? errors?.[field.key] : undefined;
          const note = helper?.(field.key, values[field.key] ?? "");
          return (
            <Box key={field.key}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, minHeight: 48 }}>
                <Typography component="label" htmlFor={id} sx={{ flexGrow: 1 }}>
                  {field.label}
                </Typography>
                <OutlinedInput
                  id={id}
                  size="small"
                  error={Boolean(problem)}
                  value={values[field.key] ?? ""}
                  onChange={(event) => onChange(field.key, event.target.value)}
                  onBlur={() => setTouched((previous) => new Set(previous).add(field.key))}
                  inputProps={{ inputMode, style: { textAlign: "right" } }}
                  sx={{ width: 96 }}
                />
                {note ? <HelpTip label={field.label} text={note} /> : <Box sx={{ width: 44 }} />}
              </Box>
              {problem && (
                <FormHelperText error sx={{ mt: -0.5, mb: 0.5 }}>
                  {problem}
                </FormHelperText>
              )}
            </Box>
          );
        })}
      </AccordionDetails>
    </Accordion>
  );
};

export default SettingsSection;
