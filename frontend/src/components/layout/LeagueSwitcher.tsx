import AddIcon from "@mui/icons-material/Add";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { Box, ButtonBase, Chip, Divider, ListItemText, Menu, MenuItem } from "@mui/material";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { LeagueByUser } from "../../api/types";
import { leaguePath } from "../../routes";
import { tokens } from "../../theme";
import PictureAvatar from "../common/PictureAvatar";
import { NewActivityDot } from "./NewActivityDot";

/** The current league's name with a chevron, right-aligned beside the avatar; opens the user's leagues and "Create a league". */
const LeagueSwitcher = ({ league, leagues }: { league: LeagueByUser; leagues: LeagueByUser[] }) => {
  const navigate = useNavigate();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const go = (to: string) => {
    setAnchor(null);
    navigate(to);
  };

  return (
    <>
      <ButtonBase
        aria-haspopup="menu"
        aria-expanded={anchor !== null}
        onClick={(event) => setAnchor(event.currentTarget)}
        sx={{
          // The name gives way first (64px to 172px with the picture and chevron); the logo never truncates.
          flex: "0 1 auto",
          minWidth: 64,
          maxWidth: 172,
          minHeight: 44,
          justifyContent: "flex-end",
          gap: 0.5,
          fontSize: 15,
          fontWeight: 600,
          color: tokens.text,
          textAlign: "right",
        }}
      >
        <PictureAvatar url={league.avatarUrl} name={league.name} size={24} fallback="tile" />
        <Box
          component="span"
          sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
        >
          {league.name}
        </Box>
        <KeyboardArrowDownIcon sx={{ fontSize: 18, color: tokens.muted, flex: "none" }} />
      </ButtonBase>
      <Menu
        anchorEl={anchor}
        open={anchor !== null}
        onClose={() => setAnchor(null)}
        slotProps={{ paper: { sx: { minWidth: 240, maxWidth: "calc(100vw - 32px)" } } }}
      >
        {leagues.map((item) => (
          <MenuItem
            key={item.id}
            selected={item.id === league.id}
            onClick={() => go(leaguePath(item.id))}
            sx={{ minHeight: 48, gap: 1 }}
          >
            <PictureAvatar url={item.avatarUrl} name={item.name} size={28} fallback="tile" />
            <ListItemText
              primary={item.name}
              slotProps={{ primary: { noWrap: true } }}
              sx={{ minWidth: 0 }}
            />
            {item.finished && <Chip size="small" variant="outlined" label="Season over" />}
            {item.hasNewActivity && <NewActivityDot label="New activity" />}
          </MenuItem>
        ))}
        {leagues.length > 0 && <Divider />}
        <MenuItem onClick={() => go("/create-league")} sx={{ minHeight: 48 }}>
          <AddIcon fontSize="small" sx={{ mr: 1 }} /> Create a league
        </MenuItem>
      </Menu>
    </>
  );
};

export default LeagueSwitcher;
