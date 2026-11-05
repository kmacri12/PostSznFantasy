import { Box } from "@mui/material";
import { Link, useLocation } from "react-router-dom";
import type { LeagueByUser } from "../../api/types";
import { TAB_BAR_HEIGHT, tokens } from "../../theme";
import { activeTabIndex, leagueTabs } from "./leagueTabs";
import { NewActivityDot } from "./NewActivityDot";
import { TAB_ICONS } from "./TabIcons";

/** Phone navigation inside a league: five destinations, fixed to the bottom edge. */
const BottomTabBar = ({ league }: { league: LeagueByUser }) => {
  const { pathname } = useLocation();
  const tabs = leagueTabs(league);
  const active = activeTabIndex(tabs, pathname);

  return (
    <Box
      component="nav"
      aria-label="League sections"
      sx={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: (theme) => theme.zIndex.appBar,
        display: "flex",
        height: `calc(${TAB_BAR_HEIGHT}px + env(safe-area-inset-bottom))`,
        paddingBottom: "env(safe-area-inset-bottom)",
        bgcolor: tokens.bg,
        borderTop: `1px solid ${tokens.border}`,
      }}
    >
      {tabs.map((tab, index) => {
        const Icon = TAB_ICONS[tab.label];
        const selected = index === active;
        return (
          <Box
            key={tab.label}
            component={Link}
            to={tab.to}
            aria-current={selected ? "page" : undefined}
            sx={{
              flex: 1,
              minWidth: 0,
              minHeight: 44,
              position: "relative",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "3px",
              fontSize: 11,
              textDecoration: "none",
              color: selected ? tokens.accent : tokens.muted,
            }}
          >
            <Icon />
            <span>{tab.label}</span>
            {tab.dot && (
              <NewActivityDot
                sx={{ position: "absolute", top: 10, left: "calc(50% + 6px)" }}
                label="New activity"
              />
            )}
          </Box>
        );
      })}
    </Box>
  );
};

export default BottomTabBar;
