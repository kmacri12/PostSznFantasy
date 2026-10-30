import { Box, Typography } from "@mui/material";

export const formatClock = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  const mmss = `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
  return hours > 0 ? `${hours}:${mmss}` : mmss;
};

interface Props {
  secondsLeft: number | null;
  isConnected: boolean;
  urgent?: boolean;
  compact?: boolean;
}

/** Server-derived countdown; dimmed while offline because it can no longer be trusted. */
const PickClock = ({ secondsLeft, isConnected, urgent = false, compact = false }: Props) => {
  if (secondsLeft === null) return null;
  return (
    <Box sx={{ textAlign: "center" }}>
      <Typography
        variant={compact ? "h4" : "h3"}
        aria-label="Pick clock"
        sx={{
          fontVariantNumeric: "tabular-nums",
          color: urgent && isConnected ? "error.main" : "inherit",
          opacity: isConnected ? 1 : 0.4,
        }}
      >
        {formatClock(secondsLeft)}
      </Typography>
      {!isConnected && (
        <Typography
          variant="caption"
          sx={{ display: "block", color: compact ? "inherit" : "warning.main" }}
        >
          Reconnecting…
        </Typography>
      )}
    </Box>
  );
};

export default PickClock;
