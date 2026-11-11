import { Box } from "@mui/material";
import { Link, useLocation } from "react-router-dom";
import type { LeagueByUser } from "../../api/types";
import { RAIL_WIDTH, tokens } from "../../theme";
import Brand from "./Brand";
import { CountBadge } from "./CountBadge";
import { activeTabIndex, leagueTabs } from "./leagueTabs";
import { NewActivityDot } from "./NewActivityDot";
import { TAB_ICONS } from "./TabIcons";

/** Desktop navigation inside a league: the full logo and the five destinations. */
const LeagueRail = ({ league }: { league: LeagueByUser }) => {
  const { pathname } = useLocation();
  const tabs = leagueTabs(league);
  const active = activeTabIndex(tabs, pathname);

  return (
    <Box
      component="nav"
      aria-label="League sections"
      sx={{
        width: RAIL_WIDTH,
        flex: "none",
        position: "sticky",
        top: 0,
        alignSelf: "flex-start",
        height: "100vh",
        boxSizing: "border-box",
        p: "16px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 0.5,
        borderRight: `1px solid ${tokens.border}`,
      }}
    >
      <Box sx={{ px: 1, pb: 2 }}>
        <Brand inLeague />
      </Box>
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
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              height: 44,
              px: 1.5,
              borderRadius: "10px",
              textDecoration: "none",
              fontSize: 15,
              fontWeight: selected ? 600 : 400,
              color: selected ? tokens.accent : tokens.textSoft,
              bgcolor: selected ? tokens.surface : "transparent",
              "&:hover": { bgcolor: tokens.surface },
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
              <Icon sx={{ fontSize: 20 }} />
              {tab.label}
            </Box>
            {tab.count > 0 ? (
              <CountBadge count={tab.count} />
            ) : (
              tab.dot && <NewActivityDot label="New activity" />
            )}
          </Box>
        );
      })}
    </Box>
  );
};

export default LeagueRail;
