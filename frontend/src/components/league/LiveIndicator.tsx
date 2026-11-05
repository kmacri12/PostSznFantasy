import { Box, Typography } from "@mui/material";
import { useStandings } from "../../api/queries";
import { tokens } from "../../theme";
import { useNow } from "./countdown";

export const liveAgo = (updatedAt: number, now: number): string => {
  const seconds = Math.max(0, Math.round((now - updatedAt) / 1000));
  return seconds < 60 ? `${seconds}s ago` : `${Math.floor(seconds / 60)} min ago`;
};

/** "Live, updated 20s ago" while a game is on; renders nothing otherwise, as nothing refreshes then. */
const LiveIndicator = ({ seasonId }: { seasonId: number }) => {
  const standings = useStandings(seasonId);
  const now = useNow(5000);
  if (!standings.data || standings.data.gamesInProgress === 0 || !standings.dataUpdatedAt) {
    return null;
  }
  return (
    <Box role="status" sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
      <Box
        aria-hidden
        sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: tokens.accent, flex: "none" }}
      />
      <Typography variant="body2" sx={{ color: tokens.accentSoft }}>
        Live, updated {liveAgo(standings.dataUpdatedAt, now)}
      </Typography>
    </Box>
  );
};

export default LiveIndicator;
