import { Alert, Box, Button, TextField, Typography } from "@mui/material";
import { type FormEvent, useEffect, useState } from "react";

const RESEND_SECONDS = 60;

interface MagicLinkFormProps {
  onSend: (email: string) => Promise<string | null>;
}

/** Email field that swaps to a "check your inbox" confirmation once the link is sent. */
const MagicLinkForm = ({ onSend }: MagicLinkFormProps) => {
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const send = async (address: string) => {
    setSending(true);
    setError(null);
    const failure = await onSend(address);
    setSending(false);
    if (failure) {
      setError(failure);
      return;
    }
    setSentTo(address);
    setCooldown(RESEND_SECONDS);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const address = email.trim();
    if (address) void send(address);
  };

  if (sentTo) {
    return (
      <Box sx={{ display: "grid", gap: 2 }}>
        <Alert severity="success">
          Check your email. We sent a sign-in link to <strong>{sentTo}</strong>.
        </Alert>
        {error && <Alert severity="error">{error}</Alert>}
        <Typography variant="body2" color="text.secondary">
          Open the link on this device or any other. It works once and expires after an hour.
        </Typography>
        <Button
          variant="outlined"
          color="inherit"
          sx={{ minHeight: 48 }}
          disabled={sending || cooldown > 0}
          onClick={() => void send(sentTo)}
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend link"}
        </Button>
        <Button
          color="inherit"
          sx={{ minHeight: 44 }}
          onClick={() => {
            setSentTo(null);
            setCooldown(0);
          }}
        >
          Use a different email
        </Button>
      </Box>
    );
  }

  return (
    <Box component="form" onSubmit={submit} sx={{ display: "grid", gap: 2 }}>
      <TextField
        label="Email"
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        required
        fullWidth
        slotProps={{
          htmlInput: { autoComplete: "email", inputMode: "email", autoCapitalize: "none" },
        }}
      />
      {error && <Alert severity="error">{error}</Alert>}
      <Button
        type="submit"
        variant="contained"
        size="large"
        sx={{ minHeight: 48 }}
        disabled={sending || !email.trim()}
      >
        {sending ? "Sending…" : "Email me a sign-in link"}
      </Button>
    </Box>
  );
};

export default MagicLinkForm;
