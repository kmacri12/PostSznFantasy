import { Alert, Box, Switch, Typography } from "@mui/material";
import { useEffect } from "react";
import { usePushPreferences, useUpdatePushPreferences } from "../../api/queries";
import {
  NOTIFICATION_KINDS,
  NOTIFICATIONS_BLURB,
  NOTIFICATIONS_DENIED_HELP,
  NOTIFICATIONS_STATUS_NOTE,
  NOTIFICATIONS_TIP,
  QUIET_HOURS,
} from "../../content/rules";
import { usePushNotifications } from "../../hooks/usePushNotifications";
import { pushDevice } from "../../utils/pushSetup";
import HelpTip from "../common/HelpTip";

const deviceZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** The Settings row for web push: the switch asks for permission only when tapped. */
const NotificationsToggle = () => {
  const { status, busy, error, enable, disable } = usePushNotifications();
  const preferences = usePushPreferences().data;
  const update = useUpdatePushPreferences();
  const { mutate: save } = update;
  const savedZone = preferences?.timezone;
  const quiet = preferences?.quietHours;

  // Quiet hours are counted in the zone the server last heard from this browser, so a
  // member who travels keeps their own 11pm.
  useEffect(() => {
    if (quiet && savedZone !== undefined && savedZone !== deviceZone()) {
      save({ timezone: deviceZone() });
    }
  }, [quiet, savedZone, save]);

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
      {status === "on" &&
        preferences &&
        NOTIFICATION_KINDS.map(({ key, label, hint }) => (
          <Box
            key={key}
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 1,
              minHeight: 44,
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography>{label}</Typography>
              <Typography variant="caption" color="text.secondary">
                {hint}
              </Typography>
            </Box>
            <Switch
              checked={preferences[key]}
              disabled={update.isPending}
              onChange={(event) => update.mutate({ [key]: event.target.checked })}
              slotProps={{ input: { "aria-label": label } }}
            />
          </Box>
        ))}
      {status === "on" && preferences && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
            minHeight: 44,
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography>{QUIET_HOURS.label}</Typography>
            <Typography variant="caption" color="text.secondary">
              {QUIET_HOURS.hint}
            </Typography>
          </Box>
          <Switch
            checked={preferences.quietHours}
            disabled={update.isPending}
            onChange={(event) =>
              update.mutate({ quietHours: event.target.checked, timezone: deviceZone() })
            }
            slotProps={{ input: { "aria-label": QUIET_HOURS.label } }}
          />
        </Box>
      )}
      {update.isError && (
        <Alert severity="error" sx={{ mt: 1 }}>
          Couldn't save that choice. Try again.
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mt: 1 }}>
          {error}
        </Alert>
      )}
    </Box>
  );
};

export default NotificationsToggle;
