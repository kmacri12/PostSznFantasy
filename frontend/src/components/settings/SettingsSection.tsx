import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  FormControl,
  FormHelperText,
  Grid,
  InputLabel,
  OutlinedInput,
  Typography,
} from "@mui/material";
import type { SettingGroup, SettingsValues } from "../../settings/types";

interface SettingsSectionProps {
  group: SettingGroup;
  values: SettingsValues;
  onChange: (key: string, rawValue: string) => void;
  title?: string;
  defaultExpanded?: boolean;
  disabled?: boolean;
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
  helper,
}: SettingsSectionProps) => (
  <Accordion defaultExpanded={defaultExpanded} disableGutters>
    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
      <Typography variant="subtitle1" fontWeight={600}>
        {title ?? group.title}
      </Typography>
    </AccordionSummary>
    <AccordionDetails>
      <Grid container spacing={2}>
        {group.fields.map((field) => {
          const id = field.key.replaceAll("_", "-");
          return (
            <Grid item xs={12} sm={6} md={4} key={field.key}>
              <FormControl fullWidth margin="dense" disabled={disabled}>
                <InputLabel htmlFor={id}>{field.label}</InputLabel>
                <OutlinedInput
                  id={id}
                  value={values[field.key] ?? ""}
                  onChange={(event) => onChange(field.key, event.target.value)}
                  label={field.label}
                />
                {helper && (
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

export default SettingsSection;
