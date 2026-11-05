import { Alert, Box, Switch, Typography } from "@mui/material";
import {
  NOTIFICATIONS_ANDROID_HELP,
  NOTIFICATIONS_BLURB,
  NOTIFICATIONS_IPHONE_STEPS,
} from "../../content/rules";
import { usePushNotifications } from "../../hooks/usePushNotifications";
import HelpTip from "../common/HelpTip";

const STATUS_NOTE = {
  unsupported: "This browser can't show notifications.",
  unconfigured: "Notifications aren't available yet.",
  denied: "Notifications are blocked. Allow them for this site in your browser settings.",
  "needs-install":
    "On iPhone, add the site to your Home Screen and open it from the icon, then switch this on.",
} as const;

/** The Settings row for web push: the switch asks for permission only when tapped. */
const NotificationsToggle = () => {
  const { status, busy, error, enable, disable } = usePushNotifications();

  if (status === "loading") return null;

  const note = status in STATUS_NOTE ? STATUS_NOTE[status as keyof typeof STATUS_NOTE] : null;
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
        <HelpTip
          label="notification help"
          text={`How to get notifications on iPhone: ${NOTIFICATIONS_IPHONE_STEPS.map((step, index) => `${index + 1}. ${step}`).join(" ")} ${NOTIFICATIONS_ANDROID_HELP}`}
        />
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
