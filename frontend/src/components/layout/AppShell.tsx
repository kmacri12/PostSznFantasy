import { Box, useMediaQuery, useTheme } from "@mui/material";
import type { User as SupabaseUser } from "@supabase/auth-js";
import type { ReactNode } from "react";
import type { LeagueByUser } from "../../api/types";
import { TAB_BAR_HEIGHT } from "../../theme";
import BottomTabBar from "./BottomTabBar";
import LeagueRail from "./LeagueRail";
import NavBar from "./NavBar";

interface AppShellProps {
  user: SupabaseUser | null;
  leagues: LeagueByUser[];
  /** The league the route shows, when the user belongs to it. */
  league?: LeagueByUser;
  onSignIn: () => void;
  onSignOut: () => void;
  dormant?: boolean;
  /** Page content that sits under the header (banners included). */
  children: ReactNode;
}

/**
 * Header plus navigation. Inside a league: bottom tabs on phones, a left rail from `md` up.
 * Everywhere else just the header.
 */
const AppShell = ({ league, children, ...header }: AppShellProps) => {
  const wide = useMediaQuery(useTheme().breakpoints.up("md"));
  const inLeague = league !== undefined && !header.dormant && header.user !== null;
  const rail = inLeague && wide;
  const tabs = inLeague && !wide;
  const navBar = <NavBar {...header} league={inLeague ? league : undefined} railed={rail} />;

  if (rail) {
    return (
      <Box sx={{ display: "flex" }}>
        <LeagueRail league={league} leagues={header.leagues} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {navBar}
          {children}
        </Box>
      </Box>
    );
  }
  return (
    <>
      {navBar}
      {children}
      {tabs && (
        <>
          <Box sx={{ height: `calc(${TAB_BAR_HEIGHT}px + env(safe-area-inset-bottom))` }} />
          <BottomTabBar league={league} />
        </>
      )}
    </>
  );
};

export default AppShell;
