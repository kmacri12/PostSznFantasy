import { Alert, Button, Stack, Typography } from "@mui/material";
import { usePushNotifications } from "../../hooks/usePushNotifications";

const STATUS_COPY = {
  unsupported: "This browser can't show notifications.",
  unconfigured: "Notifications aren't available yet.",
  denied: "Notifications are blocked. Allow them for this site in your browser settings.",
} as const;

const NotificationsToggle = () => {
  const { status, busy, error, enable, disable } = usePushNotifications();
  const touch = { minHeight: 44 };

  if (status === "loading") return null;

  return (
    <Stack spacing={1.5}>
      <Typography variant="subtitle1" component="h3">
        Notifications
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Get a message when your draft pick is on the clock and before your lineup locks.
      </Typography>
      {status === "needs-install" && (
        <Alert severity="info">
          On iPhone, notifications work once the site is on your Home Screen. In Safari tap Share,
          then Add to Home Screen, open PostSzn from the new icon, and come back here to turn them
          on.
        </Alert>
      )}
      {(status === "unsupported" || status === "unconfigured" || status === "denied") && (
        <Typography variant="body2" color="text.secondary">
          {STATUS_COPY[status]}
        </Typography>
      )}
      {status === "off" && (
        <Button variant="contained" sx={touch} disabled={busy} onClick={enable}>
          Turn on notifications
        </Button>
      )}
      {status === "on" && (
        <Button variant="outlined" sx={touch} disabled={busy} onClick={disable}>
          Turn off notifications on this device
        </Button>
      )}
      {error && <Alert severity="error">{error}</Alert>}
    </Stack>
  );
};

export default NotificationsToggle;
