import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import ArrowDropUpIcon from "@mui/icons-material/ArrowDropUp";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { Box, Tooltip } from "@mui/material";
import { tokens } from "../../theme";
import { visuallyHidden } from "../common/visuallyHidden";

interface RankCellProps {
  label: string;
  /** Why a tie put this team here, if one did; the rank becomes a button showing it. */
  note: string | null;
  color?: string;
  /** Places moved up (negative: down) in the latest finished round; nothing when null or 0. */
  change?: number | null;
}

const base = {
  width: 44,
  minHeight: 44,
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 800,
  fontSize: 20,
};

const moveWords = (change: number): string =>
  change === 0
    ? "no change"
    : `${change > 0 ? "up" : "down"} ${Math.abs(change)} ${Math.abs(change) === 1 ? "place" : "places"}`;

/** A small green up or red down arrow with the places moved, under the rank. */
const Movement = ({ change }: { change: number }) => {
  // No move still takes the line, so the ranks of a list stay level with each other.
  if (change === 0)
    return (
      <Box component="span" sx={{ fontSize: 11, lineHeight: 1, color: tokens.muted, mt: 0.25 }}>
        <span aria-hidden>–</span>
        <Box component="span" sx={visuallyHidden}>
          , no change
        </Box>
      </Box>
    );
  const up = change > 0;
  const Arrow = up ? ArrowDropUpIcon : ArrowDropDownIcon;
  return (
    <Box
      component="span"
      sx={{
        display: "flex",
        alignItems: "center",
        fontSize: 11,
        fontWeight: 700,
        lineHeight: 1,
        color: up ? tokens.green : tokens.red,
        mt: -0.25,
      }}
    >
      <Arrow aria-hidden sx={{ fontSize: 16, mr: -0.25 }} />
      <span aria-hidden>{Math.abs(change)}</span>
      <Box component="span" sx={visuallyHidden}>{`, ${moveWords(change)}`}</Box>
    </Box>
  );
};

const stacked = { flexDirection: "column", gap: 0 } as const;

/** The rank, with the tiebreaker explanation in a tooltip that also opens on touch and focus. */
const RankCell = ({ label, note, color = tokens.muted, change }: RankCellProps) => {
  const moved = change == null ? null : <Movement change={change} />;
  return note ? (
    <Tooltip title={note} arrow enterTouchDelay={0} leaveTouchDelay={6000}>
      <Box
        component="button"
        type="button"
        aria-label={`Rank ${label}${change == null ? "" : `, ${moveWords(change)}`}. ${note}`}
        sx={{
          ...base,
          all: "unset",
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "help",
          color,
          gap: 0.25,
          ...(moved ? stacked : {}),
          "&:focus-visible": { outline: `2px solid ${tokens.accent}`, outlineOffset: -2 },
        }}
      >
        <Box component="span" sx={{ display: "flex", alignItems: "flex-start" }}>
          <span aria-hidden>{label}</span>
          <InfoOutlinedIcon aria-hidden sx={{ fontSize: 12, mt: 0.5 }} />
        </Box>
        {moved}
      </Box>
    </Tooltip>
  ) : (
    <Box sx={{ ...base, ...(moved ? stacked : {}), color }}>
      <span>{label}</span>
      {moved}
    </Box>
  );
};

export default RankCell;
