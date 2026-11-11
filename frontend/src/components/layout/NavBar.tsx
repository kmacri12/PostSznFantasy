import { AppBar, Box, Button, IconButton, Toolbar, useMediaQuery, useTheme } from "@mui/material";
import type { User as SupabaseUser } from "@supabase/auth-js";
import { useState } from "react";
import type { LeagueByUser } from "../../api/types";
import { useUserAvatar, useUsername } from "../../contexts/UserContext";
import { HEADER_HEIGHT, tokens } from "../../theme";
import PictureAvatar from "../common/PictureAvatar";
import { DevQuickSync } from "../dev/DevQuickSync";
import ProfileSheet from "../settings/ProfileSheet";
import Brand from "./Brand";
import InboxBell from "./InboxBell";
import LeagueSwitcher from "./LeagueSwitcher";

interface NavBarProps {
  user: SupabaseUser | null;
  /** All of the user's leagues, for the switcher. */
  leagues: LeagueByUser[];
  /** The league the route shows; undefined outside a league. */
  league?: LeagueByUser;
  /** Desktop inside a league: the rail carries the logo, so the header holds the switcher and the account. */
  railed?: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
  dormant?: boolean;
}

/** The header: the full logo on the left; the league switcher, the notification bell and the avatar (profile settings) on the right. */
const NavBar = ({
  user,
  leagues,
  league,
  railed = false,
  onSignIn,
  onSignOut,
  dormant = false,
}: NavBarProps) => {
  const isMobile = useMediaQuery(useTheme().breakpoints.down("md"));
  const avatarUrl = useUserAvatar();
  const username = useUsername();
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <AppBar
      position="sticky"
      color="transparent"
      elevation={0}
      sx={{ bgcolor: tokens.bg, borderBottom: `1px solid ${tokens.border}` }}
    >
      <Toolbar sx={{ gap: 1.25, minHeight: HEADER_HEIGHT, px: { xs: 2, md: 3 } }}>
        {!railed && <Brand inLeague={league !== undefined} />}
        <Box sx={{ flexGrow: 1 }} />
        {!isMobile && <DevQuickSync />}
        {league && <LeagueSwitcher league={league} leagues={leagues} />}

        {user ? (
          <>
            {!dormant && <InboxBell />}
            <IconButton
              aria-label="Profile settings"
              aria-haspopup="dialog"
              onClick={() => setProfileOpen(true)}
            >
              <PictureAvatar url={avatarUrl} name={username || "?"} />
            </IconButton>
            {profileOpen && (
              <ProfileSheet
                user={user}
                onSignOut={onSignOut}
                onClose={() => setProfileOpen(false)}
              />
            )}
          </>
        ) : dormant ? null : (
          <Button variant="contained" onClick={onSignIn}>
            Sign in
          </Button>
        )}
      </Toolbar>
    </AppBar>
  );
};

export default NavBar;
