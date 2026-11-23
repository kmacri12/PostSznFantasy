import { Box } from "@mui/material";
import { tokens } from "../../theme";
import { PLAYER_STATUSES, type PlayerStatus } from "./lineupView";

export const STATUS_COLOR: Record<PlayerStatus, string> = {
  advanced: tokens.green,
  live: tokens.live,
  toPlay: tokens.inputBorder,
  eliminated: tokens.red,
};

export const STATUS_LABEL: Record<PlayerStatus, string> = {
  advanced: "advanced",
  live: "live",
  toPlay: "to play",
  eliminated: "eliminated",
};

/** The squares only: one per player, green, blue, grey, red, in a grid of `columns`. */
const StatusPips = ({
  counts,
  size,
  gap,
  columns,
}: {
  counts: Record<PlayerStatus, number>;
  size: number;
  gap: number;
  columns: number;
}) => {
  const pips: { key: string; status: PlayerStatus }[] = [];
  for (const status of PLAYER_STATUSES) {
    for (let n = 0; n < counts[status]; n += 1) pips.push({ key: `${status}-${n}`, status });
  }
  return (
    <Box
      aria-hidden
      sx={{
        display: "grid",
        gridTemplateColumns: `repeat(${columns}, ${size}px)`,
        gap: `${gap}px`,
      }}
    >
      {pips.map((pip) => (
        <Box
          key={pip.key}
          component="span"
          sx={{
            width: size,
            height: size,
            borderRadius: size > 7 ? "3px" : "2px",
            bgcolor: STATUS_COLOR[pip.status],
          }}
        />
      ))}
    </Box>
  );
};

export default StatusPips;
