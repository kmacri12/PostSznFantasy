import GoogleIcon from "@mui/icons-material/Google";
import {
  Alert,
  Box,
  Button,
  Card,
  Container,
  Divider,
  Link as MuiLink,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import MagicLinkForm from "../components/auth/MagicLinkForm";
import PostSignInRedirect from "../components/auth/PostSignInRedirect";
import LoadingState from "../components/common/LoadingState";
import { useUser } from "../contexts/UserContext";
import { safeNextPath } from "../utils/authRedirect";
import { initialCallbackError } from "../utils/supabase";

const callbackErrorMessage = (code: string): string =>
  code === "otp_expired"
    ? "That sign-in link expired or was already used. Request a new one below."
    : "We couldn't finish signing you in. Try again below.";

const SignInPage = () => {
  const { user, loading, signInWithGoogle, signInWithEmail } = useUser();
  const [params] = useSearchParams();
  const next = safeNextPath(params.get("next"));
  const [googleError, setGoogleError] = useState<string | null>(null);
  // Captured once: the URL error is stale after the visitor requests a new link.
  const [callbackError] = useState(initialCallbackError);
  useEffect(() => {
    if (callbackError)
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }, [callbackError]);

  if (loading) {
    return (
      <Container maxWidth="xs" sx={{ py: 6 }}>
        <LoadingState what="sign-in" rows={2} />
      </Container>
    );
  }
  if (user) return <PostSignInRedirect next={next} />;

  return (
    <Container maxWidth="xs" sx={{ py: { xs: 3, sm: 8 } }}>
      <Card sx={{ p: { xs: 2.5, sm: 4 }, display: "grid", gap: 2.5 }}>
        <Box>
          <Typography variant="h5" component="h1">
            Sign in to PostSzn
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            {next.startsWith("/join/")
              ? "Sign in to join the league you were invited to."
              : "Join or run a playoff fantasy league."}
          </Typography>
        </Box>

        {callbackError && (
          <Alert severity="warning">{callbackErrorMessage(callbackError.code)}</Alert>
        )}

        <MagicLinkForm onSend={(email) => signInWithEmail(email, next)} />

        <Divider>or</Divider>

        <Box sx={{ display: "grid", gap: 1 }}>
          <Button
            variant="outlined"
            color="inherit"
            size="large"
            startIcon={<GoogleIcon />}
            sx={{ minHeight: 48 }}
            onClick={async () => setGoogleError(await signInWithGoogle(next))}
          >
            Continue with Google
          </Button>
          {googleError && <Alert severity="error">{googleError}</Alert>}
        </Box>

        <Typography variant="body2" color="text.secondary">
          By continuing you agree to the{" "}
          <MuiLink component={Link} to="/terms">
            Terms
          </MuiLink>{" "}
          and{" "}
          <MuiLink component={Link} to="/privacy">
            Privacy Policy
          </MuiLink>
          .
        </Typography>
      </Card>
    </Container>
  );
};

export default SignInPage;
