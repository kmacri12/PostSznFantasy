import { Alert, Box, Button, TextField, Typography } from "@mui/material";
import { type FormEvent, useEffect, useState } from "react";
import { maskEmail } from "../../utils/maskEmail";

const RESEND_SECONDS = 60;
// Supabase issues 6 digits by default and lets the project raise it to 10.
const MIN_CODE_LENGTH = 6;
const MAX_CODE_LENGTH = 10;

interface EmailCodeFormProps {
  onSend: (email: string) => Promise<string | null>;
  onVerify: (email: string, code: string) => Promise<string | null>;
}

/** Email field that swaps to a code field once the one-time code is sent. */
const EmailCodeForm = ({ onSend, onVerify }: EmailCodeFormProps) => {
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const send = async (address: string) => {
    setBusy(true);
    setError(null);
    setResent(false);
    const failure = await onSend(address);
    setBusy(false);
    if (failure) {
      setError(failure);
      return;
    }
    setResent(sentTo !== null);
    setSentTo(address);
    setCode("");
    setCooldown(RESEND_SECONDS);
  };

  const submitEmail = (event: FormEvent) => {
    event.preventDefault();
    const address = email.trim();
    if (address) void send(address);
  };

  const submitCode = async (event: FormEvent) => {
    event.preventDefault();
    if (!sentTo) return;
    setBusy(true);
    setError(null);
    const failure = await onVerify(sentTo, code);
    // On success the session arrives and this page redirects, so the form is left as is.
    if (failure) {
      setError(failure);
      setBusy(false);
    }
  };

  const goBack = () => {
    setSentTo(null);
    setCode("");
    setError(null);
    setCooldown(0);
    setResent(false);
  };

  if (sentTo) {
    return (
      <Box component="form" onSubmit={submitCode} sx={{ display: "grid", gap: 2 }}>
        <Typography>
          We emailed a sign-in code to <strong>{maskEmail(sentTo)}</strong>. Enter it below. It
          works once and expires after an hour. Nothing yet? Check your spam folder.
        </Typography>
        <TextField
          label="Sign-in code"
          value={code}
          onChange={(event) =>
            setCode(event.target.value.replace(/\D/g, "").slice(0, MAX_CODE_LENGTH))
          }
          required
          fullWidth
          autoFocus
          slotProps={{
            htmlInput: {
              inputMode: "numeric",
              autoComplete: "one-time-code",
              pattern: "[0-9]*",
              maxLength: MAX_CODE_LENGTH,
              style: { letterSpacing: "0.3em" },
            },
          }}
        />
        {error && <Alert severity="error">{error}</Alert>}
        {resent && !error && <Alert severity="success">A new code is on its way.</Alert>}
        <Button
          type="submit"
          variant="contained"
          size="large"
          sx={{ minHeight: 48 }}
          disabled={busy || code.length < MIN_CODE_LENGTH}
        >
          {busy ? "Checking…" : "Sign in"}
        </Button>
        <Button
          variant="outlined"
          color="inherit"
          sx={{ minHeight: 48 }}
          disabled={busy || cooldown > 0}
          onClick={() => void send(sentTo)}
        >
          {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
        </Button>
        <Button color="inherit" sx={{ minHeight: 44 }} disabled={busy} onClick={goBack}>
          Use a different email
        </Button>
      </Box>
    );
  }

  return (
    <Box component="form" onSubmit={submitEmail} sx={{ display: "grid", gap: 2 }}>
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
        disabled={busy || !email.trim()}
      >
        {busy ? "Sending…" : "Email me a sign-in code"}
      </Button>
    </Box>
  );
};

export default EmailCodeForm;
