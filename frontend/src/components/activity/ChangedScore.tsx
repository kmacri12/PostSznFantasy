import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { Box, Tooltip, Typography } from "@mui/material";
import type { LineupPlayer } from "../../api/types";
import { formatWhen } from "./describe";

const pts = (value: number) => `${Number(value.toFixed(2))} pts`;

/** A player's round score; one that changed after the fact explains itself on tap/hover. */
const ChangedScore = ({ player }: { player: LineupPlayer }) => {
  if (player.points === null) return null;
  const change = player.scoreChange;
  if (!change) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
        {pts(player.points)}
      </Typography>
    );
  }
  const text = `Was ${pts(change.previousPoints)}, now ${pts(change.newPoints)}. Changed ${formatWhen(change.changedAt)}.`;
  return (
    <Tooltip
      title={text}
      enterTouchDelay={0}
      leaveTouchDelay={5000}
      slotProps={{ popper: { sx: { zIndex: (theme) => theme.zIndex.tooltip } } }}
    >
      <Box
        component="button"
        type="button"
        aria-label={`${pts(player.points)}, score changed. ${text}`}
        onClick={(event: React.MouseEvent) => event.stopPropagation()}
        sx={{
          all: "unset",
          boxSizing: "border-box",
          display: "inline-flex",
          alignItems: "center",
          gap: 0.5,
          minHeight: 44,
          minWidth: 44,
          justifyContent: "flex-end",
          cursor: "help",
          whiteSpace: "nowrap",
          fontSize: 14,
          textDecoration: "underline dotted",
          "&:focus-visible": { outline: "2px solid currentColor", outlineOffset: 2 },
        }}
      >
        {pts(player.points)}
        <InfoOutlinedIcon fontSize="inherit" />
      </Box>
    </Tooltip>
  );
};

export default ChangedScore;
