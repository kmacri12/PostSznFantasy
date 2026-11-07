import {
  AppBar,
  Box,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Toolbar,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import type { User as SupabaseUser } from "@supabase/auth-js";
import { useState } from "react";
import type { LeagueByUser } from "../../api/types";
import { useUserAvatar } from "../../contexts/UserContext";
import { HEADER_HEIGHT, tokens } from "../../theme";
import PictureAvatar from "../common/PictureAvatar";
import { DevQuickSync } from "../dev/DevQuickSync";
import Brand from "./Brand";
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

/** The header: the full logo on the left; the league switcher and the account menu on the right. */
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
  const [profileAnchor, setProfileAnchor] = useState<HTMLElement | null>(null);

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
            <IconButton
              aria-label="Account menu"
              onClick={(event) => setProfileAnchor(event.currentTarget)}
            >
              <PictureAvatar
                url={avatarUrl}
                name={user.user_metadata?.full_name || user.email || "?"}
              />
            </IconButton>
            <Menu
              anchorEl={profileAnchor}
              open={!!profileAnchor}
              onClose={() => setProfileAnchor(null)}
            >
              <MenuItem disabled>{user.email}</MenuItem>
              <MenuItem
                onClick={() => {
                  setProfileAnchor(null);
                  onSignOut();
                }}
              >
                Sign out
              </MenuItem>
            </Menu>
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
