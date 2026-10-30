import { Box, Typography } from "@mui/material";
import type { Standings } from "../../api/types";
import { ROUND_LABELS } from "../team/lineup";

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/** Where the postseason stands: the round, games being played and players left league-wide. */
const LiveSummary = ({ standings }: { standings: Standings }) => (
  <Box
    sx={{
      display: "flex",
      flexWrap: "wrap",
      columnGap: 2,
      rowGap: 0.25,
      alignItems: "baseline",
      mb: 1,
    }}
  >
    <Typography sx={{ fontWeight: 700 }}>{ROUND_LABELS[standings.round]}</Typography>
    <Typography variant="body2" color="text.secondary">
      {plural(standings.gamesInProgress, "game")} in progress
    </Typography>
    <Typography variant="body2" color="text.secondary">
      {plural(standings.playersLeft, "player")} left in the league
    </Typography>
  </Box>
);

export default LiveSummary;
