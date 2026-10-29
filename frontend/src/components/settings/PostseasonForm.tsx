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
  Typography,
} from "@mui/material";
import { POSTSEASON_FIELDS, type PostseasonValues } from "../../settings/postseasonFields";

interface PostseasonFormProps {
  values: PostseasonValues;
  onChange: (key: string, value: number | string | boolean) => void;
  disabled?: boolean;
}

const PostseasonForm = ({ values, onChange, disabled }: PostseasonFormProps) => (
  <Box>
    <Typography variant="h6" sx={{ mb: 1 }}>
      Postseason
    </Typography>
    <Grid container spacing={2}>
      {POSTSEASON_FIELDS.map((field) => {
        const id = field.key.replaceAll("_", "-");
        return (
          <Grid item xs={12} sm={6} key={field.key}>
            {field.kind === "boolean" && (
              <FormControl fullWidth>
                <FormControlLabel
                  control={
                    <Switch
                      checked={values[field.key] === true}
                      disabled={disabled}
                      onChange={(event) => onChange(field.key, event.target.checked)}
                      inputProps={{ "aria-label": field.label }}
                    />
                  }
                  label={field.label}
                />
                {field.help && <FormHelperText>{field.help}</FormHelperText>}
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
              <FormControl fullWidth disabled={disabled}>
                <InputLabel htmlFor={id}>{field.label}</InputLabel>
                <OutlinedInput
                  id={id}
                  label={field.label}
                  value={values[field.key] ?? ""}
                  onChange={(event) => onChange(field.key, event.target.value)}
                  endAdornment="x"
                />
              </FormControl>
            )}
          </Grid>
        );
      })}
    </Grid>
  </Box>
);

export default PostseasonForm;
