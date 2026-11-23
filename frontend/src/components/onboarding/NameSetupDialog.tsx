import { Alert, Box, Button, Dialog, TextField, Typography } from "@mui/material";
import { type FormEvent, useState } from "react";
import { useUser } from "../../contexts/UserContext";
import { nameProblem, providerName } from "../../utils/displayName";

/**
 * First sign-in: "What should we call you?", prefilled from the Google name, never the email. It
 * cannot be skipped or closed: the name is what other members see in lists, chat and the draft.
 */
const NameSetupDialog = () => {
  const { user, needsNameSetup, updateDisplayName } = useUser();
  const [value, setValue] = useState(() => providerName(user) ?? "");
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  if (!needsNameSetup) return null;

  const problem = value.trim() === "" ? null : nameProblem(value);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFailure(await updateDisplayName(value));
    setSaving(false);
  };

  return (
    <Dialog open fullWidth maxWidth="xs" aria-labelledby="name-setup-title">
      <Box component="form" onSubmit={submit} sx={{ p: 2.5, display: "grid", gap: 2 }}>
        <Typography id="name-setup-title" variant="h6" component="h2">
          What should we call you?
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Other members of your leagues see this name. Your email stays private.
        </Typography>
        <TextField
          autoFocus
          fullWidth
          label="Display name"
          value={value}
          error={problem !== null}
          helperText={
            problem ?? "Your first name works well. You can change it later in Profile settings."
          }
          onChange={(event) => setValue(event.target.value)}
        />
        {failure && <Alert severity="error">{failure}</Alert>}
        <Button
          type="submit"
          variant="contained"
          sx={{ minHeight: 44 }}
          disabled={saving || nameProblem(value) !== null}
        >
          Save
        </Button>
      </Box>
    </Dialog>
  );
};

export default NameSetupDialog;
