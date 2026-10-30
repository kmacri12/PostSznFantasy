import { Alert, Button } from "@mui/material";
import { useUser } from "../../contexts/UserContext";

/** Shown when Supabase ends the session on its own; signing in returns to the same page. */
const SessionExpiredBanner = () => {
  const { sessionExpired, signIn } = useUser();
  if (!sessionExpired) return null;
  return (
    <Alert
      severity="warning"
      sx={{ borderRadius: 0 }}
      action={
        <Button color="inherit" size="small" onClick={signIn} sx={{ minHeight: 44 }}>
          Sign in
        </Button>
      }
    >
      Your session ended. Sign in again to keep going.
    </Alert>
  );
};

export default SessionExpiredBanner;
