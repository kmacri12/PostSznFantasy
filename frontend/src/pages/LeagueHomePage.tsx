import { Navigate, useParams } from "react-router-dom";
import { useLeagueSeasons } from "../api/queries";
import QueryBoundary from "../components/common/QueryBoundary";
import { seasonPaths } from "../routes";

/** `/leagues/:leagueId` opens the league's current season. */
const LeagueHomePage = () => {
  const { leagueId } = useParams<{ leagueId: string }>();
  const seasons = useLeagueSeasons(leagueId);
  return (
    <QueryBoundary query={seasons} what="this league" page>
      {(list) => {
        const latest = list[list.length - 1];
        return latest ? (
          <Navigate to={seasonPaths(leagueId ?? "", latest.year).home} replace />
        ) : null;
      }}
    </QueryBoundary>
  );
};

export default LeagueHomePage;
