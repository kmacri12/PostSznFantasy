import {
  AppBar,
  Avatar,
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
import { HEADER_HEIGHT, tokens } from "../../theme";
import { DevQuickSync } from "../dev/DevQuickSync";
import Brand from "./Brand";
import LeagueSwitcher from "./LeagueSwitcher";

const initials = (user: SupabaseUser): string => {
  const name: string = user.user_metadata?.full_name || user.email || "?";
  const words = name.split(/[\s@.]+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
};

interface NavBarProps {
  user: SupabaseUser | null;
  /** All of the user's leagues, for the switcher. */
  leagues: LeagueByUser[];
  /** The league the route shows; undefined outside a league. */
  league?: LeagueByUser;
  /** Desktop inside a league: the logo and switcher live in the rail, so the header only holds the account. */
  railed?: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
  dormant?: boolean;
}

/** The header: logo (wordmark outside a league), the league switcher, and the account menu. */
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
  const [profileAnchor, setProfileAnchor] = useState<HTMLElement | null>(null);

  return (
    <AppBar
      position="sticky"
      color="transparent"
      elevation={0}
      sx={{ bgcolor: tokens.bg, borderBottom: `1px solid ${tokens.border}` }}
    >
      <Toolbar sx={{ gap: 1.25, minHeight: HEADER_HEIGHT, px: { xs: 2, md: 3 } }}>
        {!railed && (
          <>
            <Brand wide={!league} />
            {league && <LeagueSwitcher league={league} leagues={leagues} />}
          </>
        )}
        <Box sx={{ flexGrow: 1 }} />
        {!isMobile && <DevQuickSync />}

        {user ? (
          <>
            <IconButton
              aria-label="Account menu"
              onClick={(event) => setProfileAnchor(event.currentTarget)}
            >
              <Avatar
                src={user.user_metadata?.avatar_url}
                sx={{
                  width: 32,
                  height: 32,
                  bgcolor: tokens.border,
                  color: tokens.text,
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {initials(user)}
              </Avatar>
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
