import {
  Box,
  FormControl,
  FormControlLabel,
  FormHelperText,
  Grid,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Select,
  Switch,
} from "@mui/material";
import { useState } from "react";
import { POSTSEASON_FIELDS, type PostseasonValues } from "../../settings/postseasonFields";
import HelpTip from "../common/HelpTip";
import ReadOnlyValue from "./ReadOnlyValue";

interface PostseasonFormProps {
  values: PostseasonValues;
  onChange: (key: string, value: number | string | boolean) => void;
  disabled?: boolean;
  errors?: Record<string, string>;
}

const PostseasonForm = ({ values, onChange, disabled, errors }: PostseasonFormProps) => {
  const [touched, setTouched] = useState<Set<string>>(new Set());
  return (
    <Box>
      <Grid container spacing={2}>
        {POSTSEASON_FIELDS.map((field) => {
          const id = field.key.replaceAll("_", "-");
          if (disabled) {
            const value = values[field.key];
            const shown =
              field.kind === "boolean"
                ? value === true
                  ? "On"
                  : "Off"
                : field.kind === "select"
                  ? (field.options?.find((option) => option.value === value)?.label ??
                    String(value))
                  : `${value}x`;
            return (
              <Grid size={{ xs: 12, sm: 6 }} key={field.key}>
                <ReadOnlyValue label={field.label} value={shown} help={field.help} />
              </Grid>
            );
          }
          return (
            <Grid size={{ xs: 12, sm: 6 }} key={field.key}>
              {field.kind === "boolean" && (
                <FormControl fullWidth sx={{ flexDirection: "row", alignItems: "center" }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={values[field.key] === true}
                        onChange={(event) => onChange(field.key, event.target.checked)}
                        slotProps={{ input: { "aria-label": field.label } }}
                      />
                    }
                    label={field.label}
                    sx={{ flexGrow: 1, mr: 0 }}
                  />
                  {field.help && <HelpTip label={field.label} text={field.help} />}
                </FormControl>
              )}
              {field.kind === "select" && (
                <FormControl fullWidth>
                  <InputLabel id={`${id}-label`}>{field.label}</InputLabel>
                  <Select
                    labelId={`${id}-label`}
                    label={field.label}
                    value={String(values[field.key] ?? "")}
                    onChange={(event) => onChange(field.key, event.target.value)}
                  >
                    {field.options?.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
              {field.kind === "multiplier" && (
                <FormControl
                  fullWidth
                  error={touched.has(field.key) && Boolean(errors?.[field.key])}
                  sx={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 0.5 }}
                >
                  <InputLabel htmlFor={id}>{field.label}</InputLabel>
                  <OutlinedInput
                    id={id}
                    inputProps={{ inputMode: "decimal" }}
                    label={field.label}
                    value={values[field.key] ?? ""}
                    onChange={(event) => onChange(field.key, event.target.value)}
                    onBlur={() => setTouched((previous) => new Set(previous).add(field.key))}
                    endAdornment="x"
                    sx={{ flexGrow: 1 }}
                  />
                  {touched.has(field.key) && errors?.[field.key] && (
                    <FormHelperText sx={{ flexBasis: "100%", m: 0 }}>
                      {errors[field.key]}
                    </FormHelperText>
                  )}
                  {field.help && <HelpTip label={field.label} text={field.help} />}
                </FormControl>
              )}
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
};

export default PostseasonForm;
