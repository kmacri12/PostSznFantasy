import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { Box, ButtonBase, Typography } from "@mui/material";
import { Link } from "react-router-dom";
import { useFeatures, useStandings } from "../../api/queries";
import { tokens } from "../../theme";
import { useNow } from "./countdown";

export const liveAgo = (updatedAt: number, now: number): string => {
  const seconds = Math.max(0, Math.round((now - updatedAt) / 1000));
  return seconds < 60 ? `${seconds}s ago` : `${Math.floor(seconds / 60)} min ago`;
};

/**
 * "5 games live, 1 final · updated 20s ago" while a game is on; renders nothing otherwise, as
 * nothing refreshes then. With `schedule`, it links to the NFL schedule's live scores (unless the
 * owner's kill switch hides the schedule). Not a live region: the age changes every few seconds
 * and would be read out each time.
 */
const LiveIndicator = ({
  seasonId,
  games,
  schedule,
}: {
  seasonId: number;
  games: string;
  schedule?: string;
}) => {
  const standings = useStandings(seasonId);
  const { bracket: scheduleOn } = useFeatures();
  const now = useNow(5000);
  if (!standings.data || standings.data.gamesInProgress === 0 || !standings.dataUpdatedAt) {
    return null;
  }
  const line = (
    <>
      <Box
        aria-hidden
        sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: tokens.live, flex: "none" }}
      />
      <Typography variant="body2" sx={{ color: tokens.liveSoft }}>
        {games} · updated {liveAgo(standings.dataUpdatedAt, now)}
      </Typography>
    </>
  );
  if (!schedule || !scheduleOn) {
    return <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>{line}</Box>;
  }
  return (
    <ButtonBase
      component={Link}
      to={schedule}
      sx={{ minHeight: 44, gap: 0.75, justifyContent: "flex-start", borderRadius: 1 }}
    >
      {line}
      <ChevronRightIcon fontSize="small" sx={{ color: tokens.liveSoft }} />
    </ButtonBase>
  );
};

export default LiveIndicator;
