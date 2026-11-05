import { Alert, Box, Switch, Typography } from "@mui/material";
import {
  NOTIFICATIONS_BLURB,
  NOTIFICATIONS_DENIED_HELP,
  NOTIFICATIONS_STATUS_NOTE,
  NOTIFICATIONS_TIP,
} from "../../content/rules";
import { usePushNotifications } from "../../hooks/usePushNotifications";
import { pushDevice } from "../../utils/pushSetup";
import HelpTip from "../common/HelpTip";

/** The Settings row for web push: the switch asks for permission only when tapped. */
const NotificationsToggle = () => {
  const { status, busy, error, enable, disable } = usePushNotifications();

  if (status === "loading") return null;

  const note =
    status === "denied"
      ? NOTIFICATIONS_DENIED_HELP[pushDevice()]
      : status in NOTIFICATIONS_STATUS_NOTE
        ? NOTIFICATIONS_STATUS_NOTE[status as keyof typeof NOTIFICATIONS_STATUS_NOTE]
        : null;
  const switchable = status === "on" || status === "off";

  return (
    <Box sx={{ px: 2, py: 1 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          minHeight: 44,
        }}
      >
        <Typography sx={{ fontWeight: 600 }}>Notifications</Typography>
        <Switch
          checked={status === "on"}
          disabled={!switchable || busy}
          onChange={() => void (status === "on" ? disable() : enable())}
          slotProps={{ input: { "aria-label": "Notifications" } }}
        />
      </Box>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 0.5, pb: 0.5 }}>
        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.45, pt: 1.25 }}>
          {note ?? NOTIFICATIONS_BLURB}
        </Typography>
        <HelpTip label="notifications on iPhone and Android" text={NOTIFICATIONS_TIP} />
      </Box>
      {error && (
        <Alert severity="error" sx={{ mt: 1 }}>
          {error}
        </Alert>
      )}
    </Box>
  );
};

export default NotificationsToggle;
