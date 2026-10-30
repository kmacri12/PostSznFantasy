import { Paper, Typography } from "@mui/material";
import PickClock from "./PickClock";

interface Props {
  active: boolean;
  secondsLeft: number | null;
  isConnected: boolean;
}

/** Pinned above every draft tab so a drafter browsing players never misses their turn. */
const OnTheClockBanner = ({ active, secondsLeft, isConnected }: Props) => {
  if (!active) return null;
  return (
    <Paper
      role="status"
      sx={{
        position: "sticky",
        top: { xs: 56, sm: 64 }, // sits under the sticky NavBar toolbar
        zIndex: (theme) => theme.zIndex.appBar - 1,
        mt: 1,
        px: 2,
        py: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 2,
        bgcolor: "primary.main",
        color: "primary.contrastText",
      }}
    >
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
        You're on the clock
      </Typography>
      <PickClock secondsLeft={secondsLeft} isConnected={isConnected} compact />
    </Paper>
  );
};

export default OnTheClockBanner;
