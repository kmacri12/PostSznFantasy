import { Alert, Box, Button, Typography } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  NOTIFICATIONS_DENIED_HELP,
  OPT_IN_DONE,
  OPT_IN_IPHONE_INSTALL,
  OPT_IN_MANAGE,
  OPT_IN_NOT_NOW,
  OPT_IN_STEPS,
  OPT_IN_TITLE,
  OPT_IN_TURN_ON,
  OPT_IN_WHY,
} from "../../content/rules";
import { useUser } from "../../contexts/UserContext";
import { usePushNotifications } from "../../hooks/usePushNotifications";
import {
  isJoinedLeague,
  localDay,
  mayPrompt,
  promptRouteAllowed,
  readPromptRecord,
  recordPromptAccepted,
  recordPromptShown,
} from "../../utils/notificationPrompt";
import { pushDevice } from "../../utils/pushSetup";
import SettingsSheet from "../settings/SettingsSheet";

interface SheetProps {
  /** Closing counts as "Not now". */
  onClose: () => void;
}

const OptInSheet = ({ onClose }: SheetProps) => {
  const { status, busy, error, enable } = usePushNotifications();
  const [open, setOpen] = useState(false);
  const decided = useRef(false);
  const device = pushDevice();

  // The prompt is counted as shown only once it can actually offer something, so a device
  // where push is unavailable, blocked or already on never spends one of its two.
  useEffect(() => {
    if (status === "loading" || decided.current) return;
    decided.current = true;
    const offerable = status === "off" || status === "needs-install";
    if (offerable && recordPromptShown(localDay())) setOpen(true);
    else onClose();
  }, [status, onClose]);

  useEffect(() => {
    if (open && status === "on") recordPromptAccepted();
  }, [open, status]);

  if (!open) return null;

  const offering = status === "off" || status === "needs-install";
  return (
    <SettingsSheet title={OPT_IN_TITLE} onClose={onClose} closeLabel="Close">
      {status === "on" && (
        <>
          <Typography>{OPT_IN_DONE}</Typography>
          <Button variant="contained" sx={{ minHeight: 48 }} onClick={onClose}>
            Done
          </Button>
        </>
      )}
      {status === "denied" && (
        <>
          <Typography color="text.secondary">{NOTIFICATIONS_DENIED_HELP[device]}</Typography>
          <Button variant="outlined" sx={{ minHeight: 48 }} onClick={onClose}>
            Got it
          </Button>
        </>
      )}
      {offering && (
        <>
          <Typography color="text.secondary">{OPT_IN_WHY}</Typography>
          <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "action.hover" }}>
            <Typography variant="body2">
              {status === "needs-install" ? OPT_IN_IPHONE_INSTALL : OPT_IN_STEPS[device]}
            </Typography>
          </Box>
          {error && <Alert severity="error">{error}</Alert>}
          <Box sx={{ display: "grid", gap: 1 }}>
            {status === "off" && (
              <Button
                variant="contained"
                sx={{ minHeight: 48 }}
                disabled={busy}
                onClick={() => void enable()}
              >
                {OPT_IN_TURN_ON}
              </Button>
            )}
            <Button variant="outlined" sx={{ minHeight: 48 }} onClick={onClose}>
              {OPT_IN_NOT_NOW}
            </Button>
          </Box>
          <Typography variant="caption" color="text.secondary">
            {OPT_IN_MANAGE}
          </Typography>
        </>
      )}
    </SettingsSheet>
  );
};

/**
 * Offers notifications at the two moments a member is most likely to say yes: right after
 * signing in and right after joining a league. Creating a league never triggers it, and the
 * device's two-prompt cap (utils/notificationPrompt.ts) is enforced before anything opens.
 */
const NotificationOptIn = ({ hold = false }: { hold?: boolean }) => {
  const { userId } = useUser();
  const { pathname, state } = useLocation();
  const [pending, setPending] = useState(false);
  const [active, setActive] = useState(false);
  const [finishedThisVisit, setFinishedThisVisit] = useState(false);

  // A visit that begins on the create-league screen is not a trigger; the latch resets on
  // sign-out so the next sign-in in the same page load counts too.
  const signInHandled = useRef(false);
  useEffect(() => {
    if (userId === null) {
      signInHandled.current = false;
      return;
    }
    if (signInHandled.current) return;
    signInHandled.current = true;
    if (!pathname.startsWith("/create-league")) setPending(true);
  }, [userId, pathname]);

  useEffect(() => {
    if (isJoinedLeague(state)) setPending(true);
  }, [state]);

  useEffect(() => {
    if (pathname.startsWith("/create-league")) setPending(false);
  }, [pathname]);

  const ready =
    pending &&
    !hold &&
    !active &&
    !finishedThisVisit &&
    userId !== null &&
    promptRouteAllowed(pathname) &&
    mayPrompt(readPromptRecord(), localDay());

  useEffect(() => {
    if (ready) setActive(true);
  }, [ready]);

  // Not worth looking again this visit once the device cannot or may not be asked.
  useEffect(() => {
    if (pending && userId !== null && !mayPrompt(readPromptRecord(), localDay())) {
      setFinishedThisVisit(true);
    }
  }, [pending, userId]);

  if (!active) return null;
  return (
    <OptInSheet
      onClose={() => {
        setActive(false);
        setPending(false);
        setFinishedThisVisit(true);
      }}
    />
  );
};

export default NotificationOptIn;
