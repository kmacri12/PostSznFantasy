import { Box, Card, CardActionArea, Chip, Skeleton, Typography } from "@mui/material";
import { Link } from "react-router-dom";
import { useDraft, useStandings } from "../../api/queries";
import type { LeagueByUser } from "../../api/types";
import { leaguePath } from "../../routes";
import PictureAvatar from "../common/PictureAvatar";
import { ROUNDS } from "../league/standingsView";
import { phaseTag, rankText } from "./leagueSummary";

const formatPoints = (points: number): string => (Math.round(points * 10) / 10).toFixed(1);

/**
 * One league on the leagues page: the caller's rank and points, a dot for new feed items, and the
 * phase while it is the league's own (a draft, season over); the playoff round is on the page once.
 */
const LeagueCard = ({ league }: { league: LeagueByUser }) => {
  const standings = useStandings(league.seasonId);
  const draft = useDraft(league.draftStatus === "scheduled" ? league.seasonId : undefined);
  const rows = standings.data?.teams ?? [];
  const mine = rows.find((row) => row.teamId === league.userTeamId);
  const tag = phaseTag(league, standings.data, draft.data?.startTime ?? null);
  const rank = rankText(rows, league.userTeamId);
  const ranked = standings.data?.phase === "live" && rank !== null;
  const roundKey = ROUNDS[(standings.data?.round ?? 1) - 1]?.key;
  const roundPoints = !league.finished && mine && roundKey ? mine[roundKey] : null;
  const filled = rows.filter((row) => row.owner !== null).length;

  return (
    <Card sx={{ position: "relative" }}>
      <CardActionArea component={Link} to={leaguePath(league.id)} sx={{ p: 2, minHeight: 88 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0 }}>
          <PictureAvatar url={league.avatarUrl} name={league.name} size={36} fallback="tile" />
          <Typography variant="h6" component="h2" noWrap sx={{ pr: league.hasNewActivity ? 3 : 0 }}>
            {league.name}
          </Typography>
        </Box>
        {!tag.round && (
          <Chip
            size="small"
            label={tag.label}
            color="primary"
            variant={tag.live ? "filled" : "outlined"}
            sx={{ mt: 0.5 }}
          />
        )}
        <Box
          sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", mt: 1.5 }}
        >
          {standings.isLoading ? (
            <Skeleton width="50%" />
          ) : ranked && mine ? (
            <>
              <Box sx={{ minWidth: 0, flex: 1, pr: 1.5 }}>
                <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.75, minWidth: 0 }}>
                  <Typography
                    variant="h5"
                    component="p"
                    sx={{ lineHeight: 1.2, flexShrink: 0, whiteSpace: "nowrap" }}
                  >
                    {rank}
                  </Typography>
                  <Typography variant="subtitle1" component="p" noWrap sx={{ fontWeight: 700 }}>
                    <Box component="span" aria-hidden sx={{ color: "text.secondary", mr: 0.75 }}>
                      ·
                    </Box>
                    {mine.teamName}
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  of {rows.length} teams
                </Typography>
              </Box>
              <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                <Typography variant="h5" component="p" sx={{ lineHeight: 1.2 }}>
                  {formatPoints(mine.total)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {roundPoints === null
                    ? "points"
                    : `points · ${formatPoints(roundPoints)} this round`}
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
