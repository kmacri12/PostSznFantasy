import {
  Box,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Select,
  Switch,
} from "@mui/material";
import { POSTSEASON_FIELDS, type PostseasonValues } from "../../settings/postseasonFields";
import HelpTip from "../common/HelpTip";

interface PostseasonFormProps {
  values: PostseasonValues;
  onChange: (key: string, value: number | string | boolean) => void;
  disabled?: boolean;
}

const PostseasonForm = ({ values, onChange, disabled }: PostseasonFormProps) => (
  <Box>
    <Grid container spacing={2}>
      {POSTSEASON_FIELDS.map((field) => {
        const id = field.key.replaceAll("_", "-");
        return (
          <Grid size={{ xs: 12, sm: 6 }} key={field.key}>
            {field.kind === "boolean" && (
              <FormControl fullWidth sx={{ flexDirection: "row", alignItems: "center" }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={values[field.key] === true}
                      disabled={disabled}
                      onChange={(event) => onChange(field.key, event.target.checked)}
                      slotProps={{ input: { "aria-label": field.label } }}
                    />
                  }
                  label={field.label}
                />
                {field.help && <HelpTip label={field.label} text={field.help} />}
              </FormControl>
            )}
            {field.kind === "select" && (
              <FormControl fullWidth disabled={disabled}>
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
              <FormControl fullWidth sx={{ flexDirection: "row", alignItems: "center", gap: 0.5 }}>
                <InputLabel htmlFor={id}>{field.label}</InputLabel>
                <OutlinedInput
                  id={id}
                  readOnly={disabled}
                  inputProps={{ inputMode: "decimal" }}
                  label={field.label}
                  value={values[field.key] ?? ""}
                  onChange={(event) => onChange(field.key, event.target.value)}
                  endAdornment="x"
                  sx={{ flexGrow: 1 }}
                />
                {field.help && <HelpTip label={field.label} text={field.help} />}
              </FormControl>
            )}
          </Grid>
        );
      })}
    </Grid>
  </Box>
);

export default PostseasonForm;
