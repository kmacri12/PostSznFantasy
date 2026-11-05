import { Box, Switch, Typography } from "@mui/material";
import { NOTIFICATIONS_BLURB, NOTIFICATIONS_IPHONE_STEPS } from "../../content/rules";
import HelpTip from "../common/HelpTip";

/** Placeholder until push notifications ship: the switch is off and locked. */
const NotificationsRow = () => (
  <Box sx={{ px: 2, py: 1 }}>
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <Typography sx={{ fontWeight: 600 }}>Notifications</Typography>
      <Switch disabled checked={false} slotProps={{ input: { "aria-label": "Notifications" } }} />
    </Box>
    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 0.5, pb: 0.5 }}>
      <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.45, pt: 1.25 }}>
        {NOTIFICATIONS_BLURB} Coming soon.
      </Typography>
      <HelpTip
        label="notifications on iPhone"
        text={`How to get notifications on iPhone: ${NOTIFICATIONS_IPHONE_STEPS.map((step, index) => `${index + 1}. ${step}`).join(" ")}`}
      />
    </Box>
  </Box>
);

export default NotificationsRow;
