import { Alert, Box, Button, TextField } from "@mui/material";
import { type FormEvent, useState } from "react";
import SettingsSheet from "./SettingsSheet";

interface Props {
  title: string;
  label: string;
  initial: string;
  onSave: (value: string) => Promise<void>;
  onClose: () => void;
  maxLength?: number;
  multiline?: boolean;
  numeric?: boolean;
  /** Allow saving an empty value (the league note can be cleared). */
  allowEmpty?: boolean;
  helperText?: string;
  /** Returns a message when the value cannot be saved. */
  validate?: (value: string) => string | null;
  /** Shown when the save request fails. */
  failure: string | null;
}

/** A single field in a sheet: Cancel / Save, closing once the save succeeds. */
const EditTextSheet = ({
  title,
  label,
  initial,
  onSave,
  onClose,
  maxLength,
  multiline = false,
  numeric = false,
  allowEmpty = false,
  helperText,
  validate,
  failure,
}: Props) => {
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  const trimmed = value.trim();
  const problem = validate?.(trimmed) ?? null;
  const unchanged = trimmed === initial.trim();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await onSave(multiline ? value : trimmed);
      onClose();
    } catch {
      // The caller's mutation error is shown through `failure`.
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsSheet title={title} onClose={onClose} closeLabel="Cancel">
      <Box component="form" onSubmit={submit} sx={{ display: "grid", gap: 1.5 }}>
        <TextField
          autoFocus
          fullWidth
          label={label}
          value={value}
          multiline={multiline}
          minRows={multiline ? 5 : undefined}
          error={problem !== null}
          helperText={problem ?? helperText}
          slotProps={{ htmlInput: { maxLength, inputMode: numeric ? "numeric" : undefined } }}
          onChange={(event) => setValue(event.target.value)}
        />
        {failure && <Alert severity="error">{failure}</Alert>}
        <Button
          type="submit"
          variant="contained"
          sx={{ minHeight: 44 }}
          disabled={saving || unchanged || problem !== null || (!allowEmpty && trimmed === "")}
        >
          Save
        </Button>
      </Box>
    </SettingsSheet>
  );
};

export default EditTextSheet;
