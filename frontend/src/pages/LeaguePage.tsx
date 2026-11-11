import { Alert, Box, Container, Typography } from "@mui/material";
import { useLeagueInfo, useRecap } from "../api/queries";
import type { SeasonOverview } from "../api/types";
import DataFreshness from "../components/common/DataFreshness";
import AnnouncementCard from "../components/league/AnnouncementCard";
import LeagueNotes from "../components/league/LeagueNotes";
import PhaseBlock from "../components/league/PhaseBlock";
import RoundWinToast from "../components/league/RoundWinToast";
import Standings from "../components/league/Standings";
import SeasonRecap from "../components/recap/SeasonRecap";
import CogButton from "../components/settings/CogButton";
import { useSeasonContext } from "../contexts/SeasonContext";

/** Empty states a season can be in: no team for you, or teams nobody owned at the end. */
export const SeasonNotices = ({ season }: { season: SeasonOverview }) => (
  <>
    {season.myTeamId === null && !season.isFormerMember && (
      <Alert severity="info">
        {season.finished
          ? `You didn't have a team in the ${season.year} season.`
          : `You don't have a team in the ${season.year} season yet. Your commissioner can give you one from a team's settings.`}
      </Alert>
    )}
    {season.finished && season.openSpots > 0 && (
      <Alert severity="info">
        {season.openSpots === 1
          ? "One team had no owner when the season ended, so no one is credited for it."
          : `${season.openSpots} teams had no owner when the season ended, so no one is credited for them.`}
      </Alert>
    )}
  </>
);

/**
 * A season's home: the phase block (or, once the Super Bowl is final, the champion and
 * awards), the standings in every phase, and the commissioner's notes.
 */
const LeagueContent = () => {
  const { leagueId, seasonId, season, paths } = useSeasonContext();
  const info = useLeagueInfo(leagueId, !season.isFormerMember).data;
  const isCommissioner = info?.myRole === "commissioner";
  const recap = useRecap(seasonId).data;
  const canStartSeason = isCommissioner && info?.canStartSeason === true;
  return (
    <Container maxWidth="md" sx={{ py: { xs: 2, md: 3.5 } }}>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {info && (
          <Box
            sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}
          >
            <Typography
              variant="h1"
              sx={{ fontSize: { xs: 20, md: 26 }, fontWeight: 700, overflowWrap: "anywhere" }}
            >
              {info.name}
            </Typography>
            <CogButton label="League settings" to={paths.settings} />
          </Box>
        )}
        <SeasonNotices season={season} />
        {info && info.currentSeasonId === seasonId && <AnnouncementCard league={info} />}
        {season.finished ? (
          recap && (
            <SeasonRecap
              recap={recap}
              leagueName={season.leagueName}
              canStartSeason={canStartSeason && info?.currentSeasonId === seasonId}
            />
          )
        ) : (
          <PhaseBlock season={season} />
        )}
        {!season.finished && <RoundWinToast seasonId={seasonId} myTeamId={season.myTeamId} />}
        <Standings season={season} />
        {season.draftStatus === "completed" && !season.finished && <DataFreshness />}
        {info && <LeagueNotes league={info} />}
      </Box>
    </Container>
  );
};

export default LeagueContent;
