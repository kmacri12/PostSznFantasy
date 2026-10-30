import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { Box, Tooltip } from "@mui/material";
import { tokens } from "../../theme";

interface RankCellProps {
  label: string;
  /** Why a tie put this team here, if one did; the rank becomes a button showing it. */
  note: string | null;
  color?: string;
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

/** The rank, with the tiebreaker explanation in a tooltip that also opens on touch and focus. */
const RankCell = ({ label, note, color = tokens.muted }: RankCellProps) =>
  note ? (
    <Tooltip title={note} arrow enterTouchDelay={0} leaveTouchDelay={6000}>
      <Box
        component="button"
        type="button"
        aria-label={`Rank ${label}. ${note}`}
        sx={{
          ...base,
          all: "unset",
          boxSizing: "border-box",
          cursor: "help",
          color,
          gap: 0.25,
          "&:focus-visible": { outline: `2px solid ${tokens.gold}`, outlineOffset: -2 },
        }}
      >
        <span aria-hidden>{label}</span>
        <InfoOutlinedIcon aria-hidden sx={{ fontSize: 12, alignSelf: "flex-start", mt: 1.25 }} />
      </Box>
    </Tooltip>
  ) : (
    <Box sx={{ ...base, color }}>{label}</Box>
  );

export default RankCell;
