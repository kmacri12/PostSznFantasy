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
import { type ElementType, Fragment, useState } from "react";
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

interface SummaryLine {
  label: string;
  value: string;
}

/** The fields that score, so a collapsed or read-only block says what is in it. */
export const summaryLines = (group: SettingGroup, values: SettingsValues): SummaryLine[] =>
  group.fields
    .filter((field) => values[field.key] !== undefined && Number(values[field.key]) !== 0)
    .map((field) => {
      const value = values[field.key] ?? "";
      return { label: field.label, value: String(field.limit ? formatLimit(value) : value) };
    });

/** "Yard 0.04\nTD 4": the summary as plain text. */
export const groupSummary = (group: SettingGroup, values: SettingsValues): string =>
  summaryLines(group, values)
    .map(({ label, value }) => `${label} ${value}`)
    .join("\n") || "Nothing scored";

/**
 * Label on the left, value on the right in bold, like the editable rows, so a number in a label
 * ("Pts Allowed 0", "Yards Allowed 100-199") never reads as the points.
 */
const SummaryList = ({
  group,
  values,
  inButton = false,
}: {
  group: SettingGroup;
  values: SettingsValues;
  /** Inside the accordion's button a description list breaks the button's name, so use spans. */
  inButton?: boolean;
}) => {
  const lines = summaryLines(group, values);
  const tags: { list: ElementType; term: ElementType; value: ElementType } = inButton
    ? { list: "span", term: "span", value: "span" }
    : { list: "dl", term: "dt", value: "dd" };
  if (lines.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        Nothing scored
      </Typography>
    );
  }
  return (
    <Box
      component={tags.list}
      sx={{
        m: 0,
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto",
        columnGap: 2,
        rowGap: 0.25,
        typography: "body2",
      }}
    >
      {lines.map((line) => (
        <Fragment key={line.label}>
          <Box component={tags.term} sx={{ color: "text.secondary", minWidth: 0 }}>
            {line.label}
          </Box>
          <Box
            component={tags.value}
            sx={{
              m: 0,
              fontWeight: 700,
              color: "text.primary",
              textAlign: "right",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {line.value}
          </Box>
        </Fragment>
      ))}
    </Box>
  );
};

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
  const [expanded, setExpanded] = useState(defaultExpanded);
  const heading = title ?? group.title;
  if (disabled) {
    return (
      <Box sx={{ mb: 1.5 }}>
        <Typography sx={{ fontWeight: 700, mb: 0.5 }}>{heading}</Typography>
        <SummaryList group={group} values={values} />
      </Box>
    );
  }
  return (
    <Accordion expanded={expanded} onChange={(_, open) => setExpanded(open)} disableGutters>
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        sx={{ "& .MuiAccordionSummary-content": { minWidth: 0 } }}
      >
        <Box sx={{ minWidth: 0, flexGrow: 1, pr: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {heading}
          </Typography>
          {/* Open, the editable rows say the same thing, so the summary would only add height. */}
          {!expanded && <SummaryList group={group} values={values} inButton />}
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
