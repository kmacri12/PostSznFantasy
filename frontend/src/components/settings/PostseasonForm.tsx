import { Box, FormHelperText, OutlinedInput, Switch, Typography } from "@mui/material";
import { useState } from "react";
import { POSTSEASON_FIELDS, type PostseasonValues } from "../../settings/postseasonFields";
import HelpTip from "../common/HelpTip";

interface PostseasonFormProps {
  values: PostseasonValues;
  onChange: (key: string, value: number | string | boolean) => void;
  /** Which fields to show, in the schema's order; default all. */
  keys?: string[];
  disabled?: boolean;
  errors?: Record<string, string>;
}

/** Switches and round multipliers: label left, control right, help in the "?" tip. */
const PostseasonForm = ({ values, onChange, keys, disabled, errors }: PostseasonFormProps) => {
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const fields = POSTSEASON_FIELDS.filter((field) => !keys || keys.includes(field.key));
  if (disabled) {
    return (
      <Typography sx={{ mb: 0.75 }}>
        {fields
          .map((field) => {
            const value = values[field.key];
            return field.kind === "boolean"
              ? `${field.label} ${value === true ? "on" : "off"}`
              : `${field.label.replace(/ multiplier$/, "")} ${value}x`;
          })
          .join(" · ")}
      </Typography>
    );
  }
  return (
    <Box>
      {fields.map((field) => {
        const id = field.key.replaceAll("_", "-");
        const problem = touched.has(field.key) ? errors?.[field.key] : undefined;
        return (
          <Box key={field.key}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, minHeight: 48 }}>
              <Typography component="label" htmlFor={id} sx={{ flexGrow: 1 }}>
                {field.label}
              </Typography>
              {field.kind === "boolean" ? (
                <Switch
                  id={id}
                  checked={values[field.key] === true}
                  onChange={(event) => onChange(field.key, event.target.checked)}
                />
              ) : (
                <OutlinedInput
                  id={id}
                  size="small"
                  error={Boolean(problem)}
                  inputProps={{ inputMode: "decimal", style: { textAlign: "right" } }}
                  value={values[field.key] ?? ""}
                  onChange={(event) => onChange(field.key, event.target.value)}
                  onBlur={() => setTouched((previous) => new Set(previous).add(field.key))}
                  endAdornment="x"
                  sx={{ width: 96 }}
                />
              )}
              {field.help ? (
                <HelpTip label={field.label} text={field.help} />
              ) : (
                <Box sx={{ width: 44 }} />
              )}
            </Box>
            {problem && (
              <FormHelperText error sx={{ mt: -0.5, mb: 0.5 }}>
                {problem}
              </FormHelperText>
            )}
          </Box>
        );
      })}
    </Box>
  );
};

export default PostseasonForm;
