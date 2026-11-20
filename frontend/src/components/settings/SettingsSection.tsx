import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  FormHelperText,
  IconButton,
  OutlinedInput,
  Typography,
} from "@mui/material";
import { Fragment, useState } from "react";
import { SETTING_FIELD_HELP } from "../../content/rules";
import type { SettingGroup, SettingsValues } from "../../settings/types";
import {
  formatLimit,
  limitFieldValue,
  limitFromField,
  NO_LIMIT_LABEL,
} from "../../utils/positionLimit";
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
  /** Problems by field key; shown under a field once it has been left (blurred). */
  errors?: Record<string, string>;
  /** A row that differs from its default gets a button that puts the default back. */
  defaults?: SettingsValues;
}

const differs = (value: number | string | undefined, fallback: number | string | undefined) =>
  value !== undefined &&
  fallback !== undefined &&
  String(value).trim() !== "" &&
  Number(value) !== Number(fallback);

/** "Yard 0.04 · TD 4": the fields that score, so a collapsed block says what is in it. */
export const groupSummary = (group: SettingGroup, values: SettingsValues): string =>
  group.fields
    .filter((field) => values[field.key] !== undefined && Number(values[field.key]) !== 0)
    .map((field) => {
      const value = values[field.key] ?? "";
      return `${field.label} ${field.limit ? formatLimit(value) : value}`;
    })
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
  errors,
  defaults,
}: SettingsSectionProps) => {
  const [touched, setTouched] = useState<Set<string>>(new Set());
  // The value a field held when tapped; it empties for typing and comes back if left blank.
  const [editing, setEditing] = useState<{ key: string; original: string } | null>(null);
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
        {group.fields.map((field) => {
          const id = field.key.replaceAll("_", "-");
          const problem = touched.has(field.key) ? errors?.[field.key] : undefined;
          const note = SETTING_FIELD_HELP[field.key];
          const fallback = defaults?.[field.key];
          const changed = editing?.key !== field.key && differs(values[field.key], fallback);
          return (
            <Fragment key={field.key}>
              {field.subheading && (
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 2, mb: 0.5 }}>
                  {field.subheading}
                </Typography>
              )}
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, minHeight: 48 }}>
                <Typography component="label" htmlFor={id} sx={{ flexGrow: 1, minWidth: 0 }}>
                  {field.label}
                </Typography>
                {changed && fallback !== undefined && (
                  <IconButton
                    aria-label={`Reset ${field.label} to default`}
                    onClick={() => onChange(field.key, String(fallback))}
                    sx={{ color: "text.secondary", width: 44, height: 44, flexShrink: 0 }}
                  >
                    <RestartAltIcon fontSize="small" />
                  </IconButton>
                )}
                <OutlinedInput
                  id={id}
                  size="small"
                  error={Boolean(problem)}
                  value={
                    field.limit ? limitFieldValue(values[field.key]) : (values[field.key] ?? "")
                  }
                  placeholder={field.limit ? NO_LIMIT_LABEL : undefined}
                  onChange={(event) =>
                    onChange(
                      field.key,
                      field.limit ? limitFromField(event.target.value) : event.target.value,
                    )
                  }
                  onFocus={(event) => {
                    // A limit left empty means "No limit", so it selects instead of clearing.
                    if (field.limit) {
                      event.target.select();
                      return;
                    }
                    setEditing({ key: field.key, original: String(values[field.key] ?? "") });
                    onChange(field.key, "");
                  }}
                  onBlur={() => {
                    const blank = String(values[field.key] ?? "").trim() === "";
                    if (editing?.key === field.key && blank) {
                      onChange(field.key, editing.original);
                    } else {
                      setTouched((previous) => new Set(previous).add(field.key));
                    }
                    setEditing(null);
                  }}
                  inputProps={{ inputMode, style: { textAlign: "right" } }}
                  sx={{ width: 96, flexShrink: 0 }}
                />
                {note ? <HelpTip label={field.label} text={note} /> : <Box sx={{ width: 44 }} />}
              </Box>
              {problem && (
                <FormHelperText error sx={{ mt: -0.5, mb: 0.5 }}>
                  {problem}
                </FormHelperText>
              )}
            </Fragment>
          );
        })}
      </AccordionDetails>
    </Accordion>
  );
};

export default SettingsSection;
