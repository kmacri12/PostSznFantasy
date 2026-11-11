import { useEffect, useState, useSyncExternalStore } from "react";
import { useLocation } from "react-router-dom";
import { appOutdatedSnapshot, subscribeOutdated } from "../api/appOutdated";
import {
  BUILD_TIME,
  fetchDeployedBuild,
  isNewerBuild,
  updatePromptAllowed,
} from "../utils/appVersion";

const CHECK_EVERY_MS = 10 * 60 * 1000;

export type AppUpdate = "none" | "available" | "outdated";

/**
 * Whether a newer build is deployed ("available", from /version.json) or the API refused this
 * one ("outdated", a 426). "available" is held back during a draft and while a field has focus,
 * so a prompt never lands mid-pick or mid-sentence; "outdated" is never held, since requests
 * are already failing.
 */
export const useAppUpdate = (): AppUpdate => {
  const { pathname } = useLocation();
  const outdated = useSyncExternalStore(subscribeOutdated, appOutdatedSnapshot, () => false);
  const [deployedNewer, setDeployedNewer] = useState(false);
  const [active, setActive] = useState<Element | null>(null);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (document.visibilityState === "hidden") return;
      const deployed = await fetchDeployedBuild();
      if (!cancelled && isNewerBuild(deployed, BUILD_TIME)) setDeployedNewer(true);
    };
    void check();
    const timer = window.setInterval(check, CHECK_EVERY_MS);
    document.addEventListener("visibilitychange", check);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);

  useEffect(() => {
    const focused = (event: FocusEvent) => setActive(event.target as Element | null);
    // While focus moves, `relatedTarget` is where it lands (null when it leaves every field).
    const blurred = (event: FocusEvent) => setActive(event.relatedTarget as Element | null);
    document.addEventListener("focusin", focused);
    document.addEventListener("focusout", blurred);
    return () => {
      document.removeEventListener("focusin", focused);
      document.removeEventListener("focusout", blurred);
    };
  }, []);

  if (outdated) return "outdated";
  return deployedNewer && updatePromptAllowed(pathname, active) ? "available" : "none";
};
