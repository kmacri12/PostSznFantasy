import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useUser } from "../../contexts/UserContext";
import { E2E_BUILD } from "../../utils/e2e";
import { installOfferDue, markInstallOffered, markInstallPending } from "../../utils/install";
import { isJoinedLeague, promptRouteAllowed } from "../../utils/notificationPrompt";
import InstallGuideSheet from "./InstallGuideSheet";

/** Let the join-time prompts (name, tour, notifications) open first; this one never stacks on them. */
const SETTLE_MS = 2500;

/**
 * Offers the install guide once, on the first visit after joining a league (never the visit that
 * joined, which already has the tour and the notification prompt). Closing it counts as answered;
 * More, Install the app opens it again any time. Off in the e2e build, where a timer-driven sheet
 * would race the specs.
 */
const InstallOffer = ({ hold }: { hold: boolean }) => {
  const { userId } = useUser();
  const { pathname, state } = useLocation();
  const joinedThisLoad = useRef(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isJoinedLeague(state)) return;
    joinedThisLoad.current = true;
    markInstallPending();
  }, [state]);

  const eligible =
    !E2E_BUILD &&
    !open &&
    !hold &&
    userId !== null &&
    !joinedThisLoad.current &&
    promptRouteAllowed(pathname);

  useEffect(() => {
    if (!eligible) return;
    const timer = window.setTimeout(() => {
      if (!installOfferDue()) return;
      markInstallOffered();
      setOpen(true);
    }, SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [eligible]);

  return open ? <InstallGuideSheet onClose={() => setOpen(false)} /> : null;
};

export default InstallOffer;
