import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { Box, Tooltip, Typography } from "@mui/material";
import type { ScoreChange } from "../../api/types";
import { formatWhen } from "./describe";

const pts = (value: number) => `${Number(value.toFixed(2))} pts`;

interface Props {
  points: number | null;
  change: ScoreChange | null;
  /** Show the unit after the number; off where a column heading already gives it. */
  unit?: boolean;
  bold?: boolean;
  /** Overrides the default text colour, e.g. the live green. */
  color?: string;
  /** Font size in px for the default and changed forms. */
  size?: number;
}

/** A player's round score; one that changed after the fact explains itself on tap/hover. */
const ChangedScore = ({ points, change, unit = true, bold = false, color, size }: Props) => {
  if (points === null) return null;
  const shown = unit ? pts(points) : String(Number(points.toFixed(2)));
  if (!change) {
    return (
      <Typography
        variant="body2"
        color={color ?? (bold ? "text.primary" : "text.secondary")}
        sx={{ whiteSpace: "nowrap", fontWeight: bold ? 700 : 400, fontSize: size }}
      >
        {shown}
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
        aria-label={`${pts(points)}, score changed. ${text}`}
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
          fontSize: size ?? 14,
          color,
          fontWeight: bold ? 700 : 400,
          textDecoration: "underline dotted",
          "&:focus-visible": { outline: "2px solid currentColor", outlineOffset: 2 },
        }}
      >
        {shown}
        <InfoOutlinedIcon fontSize="inherit" />
      </Box>
    </Tooltip>
  );
};

export default ChangedScore;
