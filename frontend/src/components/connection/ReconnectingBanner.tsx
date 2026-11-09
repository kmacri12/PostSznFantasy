import { Alert, CircularProgress } from "@mui/material";

/** Shown over the current page while the API is unreachable; the health check retries on its own. */
const ReconnectingBanner = () => (
  <Alert
    severity="warning"
    icon={<CircularProgress size={18} color="inherit" />}
    role="status"
    sx={{ borderRadius: 0 }}
  >
    Reconnecting to PostSzn...
  </Alert>
);

export default ReconnectingBanner;
