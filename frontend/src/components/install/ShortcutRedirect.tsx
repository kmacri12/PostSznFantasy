import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useUserLeagues } from "../../api/queries";
import { useUser } from "../../contexts/UserContext";
import { parseShortcut, shortcutTarget } from "./shortcutTarget";

/** Resolves a Home Screen shortcut (`/?shortcut=draft`) to the member's league page. */
const ShortcutRedirect = () => {
  const { userId } = useUser();
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const shortcut = pathname === "/" ? parseShortcut(search) : null;
  const { data: leagues } = useUserLeagues(userId !== null && shortcut !== null);

  useEffect(() => {
    if (shortcut === null || !leagues) return;
    navigate(shortcutTarget(shortcut, leagues) ?? "/", { replace: true });
  }, [shortcut, leagues, navigate]);

  return null;
};

export default ShortcutRedirect;
