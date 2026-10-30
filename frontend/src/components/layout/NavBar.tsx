import AddIcon from "@mui/icons-material/Add";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import MenuIcon from "@mui/icons-material/Menu";
import SportsFootballIcon from "@mui/icons-material/SportsFootball";
import {
  AppBar,
  Avatar,
  alpha,
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Menu,
  MenuItem,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import type { LeagueByUser } from "../../api/types";
import { tokens } from "../../theme";
import { DevQuickSync } from "../dev/DevQuickSync";

interface NavBarProps {
  user: SupabaseUser | null;
  leagues: LeagueByUser[];
  selectedLeagueId: string;
  onSelectLeague: (leagueId: string) => void;
  onSignIn: () => void;
  onSignOut: () => void;
}

const NavBar = ({
  user,
  leagues,
  selectedLeagueId,
  onSelectLeague,
  onSignIn,
  onSignOut,
}: NavBarProps) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [leagueAnchor, setLeagueAnchor] = useState<HTMLElement | null>(null);
  const [profileAnchor, setProfileAnchor] = useState<HTMLElement | null>(null);

  const selected = leagues.find((league) => String(league.id) === selectedLeagueId);
  const links = selected
    ? [
        { label: "League", to: `/league/${selected.id}` },
        { label: "My Team", to: `/team/${selected.userTeamId}` },
        { label: "Draft", to: `/league/${selected.id}/draft` },
        { label: "Players", to: `/players?leagueId=${selected.id}` },
        { label: "Settings", to: `/settings?leagueId=${selected.id}` },
      ]
    : [{ label: "Players", to: "/players" }];

  const avatarLabel = (user?.user_metadata?.full_name || user?.email || "?")[0].toUpperCase();

  return (
    <AppBar
      position="sticky"
      color="transparent"
      elevation={0}
      sx={{
        backgroundColor: alpha(tokens.bg, 0.72),
        backdropFilter: "blur(14px)",
        borderBottom: `1px solid ${tokens.border}`,
      }}
    >
      <Toolbar sx={{ gap: 1 }}>
        {isMobile && (
          <IconButton edge="start" aria-label="Open menu" onClick={() => setDrawerOpen(true)}>
            <MenuIcon />
          </IconButton>
        )}
        <Box
          component={Link}
          to="/"
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            color: "inherit",
            textDecoration: "none",
            mr: { xs: 0, md: 2 },
            minWidth: 0,
            minHeight: 44,
          }}
        >
          <SportsFootballIcon sx={{ color: tokens.gold }} />
          <Typography variant="h6" sx={{ letterSpacing: "-0.02em" }}>
            PostSzn
            <Box component="span" sx={{ color: tokens.gold }}>
              Fantasy
            </Box>
          </Typography>
        </Box>

        {!isMobile &&
          links.map((link) => (
            <Button
              key={link.to}
              component={NavLink}
              to={link.to}
              color="inherit"
              sx={{
                color: tokens.muted,
                "&.active": { color: tokens.text, backgroundColor: alpha(tokens.gold, 0.12) },
              }}
            >
              {link.label}
            </Button>
          ))}

        <Box sx={{ flexGrow: 1 }} />
        {!isMobile && <DevQuickSync />}

        {user && !isMobile && (
          <Chip
            clickable
            onClick={(event) => setLeagueAnchor(event.currentTarget)}
            label={selected?.name ?? "Select league"}
            deleteIcon={<KeyboardArrowDownIcon />}
            onDelete={(event) => setLeagueAnchor(event.currentTarget.closest("div"))}
            variant="outlined"
            sx={{ borderColor: tokens.borderStrong, maxWidth: 200 }}
          />
        )}
        <Menu anchorEl={leagueAnchor} open={!!leagueAnchor} onClose={() => setLeagueAnchor(null)}>
          {leagues.map((league) => (
            <MenuItem
              key={league.id}
              selected={String(league.id) === selectedLeagueId}
              onClick={() => {
                onSelectLeague(String(league.id));
                setLeagueAnchor(null);
                navigate(`/league/${league.id}`);
              }}
            >
              {league.name}
            </MenuItem>
          ))}
          {leagues.length > 0 && <Divider />}
          <MenuItem
            onClick={() => {
              setLeagueAnchor(null);
              navigate("/create-league");
            }}
          >
            <AddIcon fontSize="small" sx={{ mr: 1 }} /> Create new league
          </MenuItem>
        </Menu>

        {user ? (
          <>
            <IconButton
              aria-label="Account menu"
              onClick={(e) => setProfileAnchor(e.currentTarget)}
            >
              <Avatar
                src={user.user_metadata?.avatar_url}
                sx={{ width: 34, height: 34, bgcolor: tokens.gold, color: "#1c1203" }}
              >
                {avatarLabel}
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
        ) : (
          <Button variant="contained" onClick={onSignIn}>
            Sign in
          </Button>
        )}
      </Toolbar>

      <Drawer anchor="left" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <List sx={{ width: 280 }}>
          {user && (
            <>
              <ListItemText
                primary="Your leagues"
                slotProps={{ primary: { variant: "overline", color: "text.secondary" } }}
                sx={{ px: 2, pt: 1 }}
              />
              {leagues.map((league) => (
                <ListItemButton
                  key={league.id}
                  selected={String(league.id) === selectedLeagueId}
                  onClick={() => {
                    onSelectLeague(String(league.id));
                    setDrawerOpen(false);
                    navigate(`/league/${league.id}`);
                  }}
                >
                  <ListItemText primary={league.name} />
                </ListItemButton>
              ))}
              <ListItemButton
                onClick={() => {
                  setDrawerOpen(false);
                  navigate("/create-league");
                }}
              >
                <AddIcon fontSize="small" sx={{ mr: 1 }} />
                <ListItemText primary="Create new league" />
              </ListItemButton>
              <Divider />
            </>
          )}
          {(selected ? links.filter((link) => link.label === "Settings") : links).map((link) => (
            <ListItemButton
              key={link.to}
              component={Link}
              to={link.to}
              onClick={() => setDrawerOpen(false)}
            >
              <ListItemText primary={link.label} />
            </ListItemButton>
          ))}
        </List>
      </Drawer>
    </AppBar>
  );
};

export default NavBar;
