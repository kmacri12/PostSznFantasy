import { Box, Card, CardActionArea, Chip, Skeleton, Typography } from "@mui/material";
import { Link } from "react-router-dom";
import { useDraft, useStandings } from "../../api/queries";
import type { LeagueByUser } from "../../api/types";
import { leaguePath } from "../../routes";
import { phaseTag, rankText } from "./leagueSummary";

const formatPoints = (points: number): string => (Math.round(points * 10) / 10).toFixed(1);

/** One league on the leagues page: phase, the caller's rank and points, a dot for new feed items. */
const LeagueCard = ({ league }: { league: LeagueByUser }) => {
  const standings = useStandings(league.seasonId);
  const draft = useDraft(league.draftStatus === "scheduled" ? league.seasonId : undefined);
  const rows = standings.data?.teams ?? [];
  const mine = rows.find((row) => row.teamId === league.userTeamId);
  const tag = phaseTag(league, standings.data, draft.data?.startTime ?? null);
  const rank = rankText(rows, league.userTeamId);
  const ranked = standings.data?.phase === "live" && rank !== null;
  const filled = rows.filter((row) => row.owner !== null).length;

  return (
    <Card sx={{ position: "relative" }}>
      <CardActionArea component={Link} to={leaguePath(league.id)} sx={{ p: 2, minHeight: 88 }}>
        <Typography variant="h6" component="h2" noWrap sx={{ pr: league.hasNewActivity ? 3 : 0 }}>
          {league.name}
        </Typography>
        <Chip
          size="small"
          label={tag.label}
          color={tag.live ? "warning" : "success"}
          variant="outlined"
          sx={{ mt: 0.5 }}
        />
        <Box
          sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", mt: 1.5 }}
        >
          {standings.isLoading ? (
            <Skeleton width="50%" />
          ) : ranked && mine ? (
            <>
              <Box>
                <Typography variant="h5" component="p" sx={{ lineHeight: 1.2 }}>
                  {rank}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  of {rows.length} teams
                </Typography>
              </Box>
              <Box sx={{ textAlign: "right" }}>
                <Typography variant="h5" component="p" sx={{ lineHeight: 1.2 }}>
                  {formatPoints(mine.total)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  points
                </Typography>
              </Box>
            </>
          ) : (
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                {mine?.teamName ?? "No team yet"}
              </Typography>
              {rows.length > 0 && (
                <Typography variant="caption" color="text.secondary">
                  {filled} of {rows.length} teams filled
                </Typography>
              )}
            </Box>
          )}
        </Box>
      </CardActionArea>
      {league.hasNewActivity && (
        <Box
          role="img"
          aria-label="New activity"
          sx={{
            position: "absolute",
            top: 14,
            right: 14,
            width: 10,
            height: 10,
            borderRadius: "50%",
            bgcolor: "error.main",
          }}
        />
      )}
    </Card>
  );
};

export default LeagueCard;
