import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  FormControl,
  FormHelperText,
  Grid,
  InputLabel,
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
  /** Shown but not editable (non-commissioners, or locked once the draft starts). */
  disabled?: boolean;
  inputMode?: "decimal" | "numeric";
  /** Plain-language note on the whole block, opened from an info button. */
  help?: string;
  /** Problems by field key; shown under a field once it has been left (blurred). */
  errors?: Record<string, string>;
  /** Optional explanation shown under an input, e.g. "1 point per 25 yards". */
  helper?: (key: string, rawValue: string | number) => string | null;
}

/** One collapsible block of numeric inputs, generated from a field schema. */
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
  return (
    <Accordion defaultExpanded={defaultExpanded} disableGutters>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          {title ?? group.title}
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        {help && (
          <Box sx={{ display: "flex", alignItems: "center", mt: -1 }}>
            <Typography variant="body2" color="text.secondary">
              What do these mean?
            </Typography>
            <HelpTip label={title ?? group.title} text={help} />
          </Box>
        )}
        <Grid container spacing={2}>
          {group.fields.map((field) => {
            const id = field.key.replaceAll("_", "-");
            const problem = touched.has(field.key) ? errors?.[field.key] : undefined;
            return (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={field.key}>
                <FormControl fullWidth margin="dense" error={Boolean(problem)}>
                  <InputLabel htmlFor={id}>{field.label}</InputLabel>
                  <OutlinedInput
                    id={id}
                    value={values[field.key] ?? ""}
                    onChange={(event) => onChange(field.key, event.target.value)}
                    label={field.label}
                    onBlur={() => setTouched((previous) => new Set(previous).add(field.key))}
                    readOnly={disabled}
                    inputProps={{ inputMode }}
                  />
                  {problem && <FormHelperText>{problem}</FormHelperText>}
                  {!problem && helper && (
                    <FormHelperText>{helper(field.key, values[field.key] ?? "")}</FormHelperText>
                  )}
                </FormControl>
              </Grid>
            );
          })}
        </Grid>
      </AccordionDetails>
    </Accordion>
  );
};

export default SettingsSection;
