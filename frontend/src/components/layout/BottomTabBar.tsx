import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import GroupsIcon from "@mui/icons-material/Groups";
import PersonSearchIcon from "@mui/icons-material/PersonSearch";
import SportsFootballIcon from "@mui/icons-material/SportsFootball";
import { BottomNavigation, BottomNavigationAction, Paper } from "@mui/material";
import { Link, useLocation } from "react-router-dom";
import type { LeagueByUser } from "../../api/types";
import { activeTabIndex, leagueTabs } from "./leagueTabs";

const ICONS = {
  League: <EmojiEventsIcon />,
  Team: <GroupsIcon />,
  Draft: <SportsFootballIcon />,
  Players: <PersonSearchIcon />,
};

export const TAB_BAR_HEIGHT = 64;

const BottomTabBar = ({ league }: { league: LeagueByUser }) => {
  const { pathname } = useLocation();
  const tabs = leagueTabs(league);
  const active = activeTabIndex(tabs, pathname);

  return (
    <Paper
      component="nav"
      aria-label="League sections"
      sx={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: (theme) => theme.zIndex.appBar,
        borderRadius: 0,
        borderWidth: "1px 0 0",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <BottomNavigation value={active} showLabels sx={{ height: TAB_BAR_HEIGHT }}>
        {tabs.map((tab) => (
          <BottomNavigationAction
            key={tab.label}
            component={Link}
            to={tab.to}
            label={tab.label}
            icon={ICONS[tab.label]}
            sx={{ minWidth: 0, minHeight: 44 }}
          />
        ))}
      </BottomNavigation>
    </Paper>
  );
};

export default BottomTabBar;
