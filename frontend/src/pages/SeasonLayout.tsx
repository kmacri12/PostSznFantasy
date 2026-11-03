import { Button } from "@mui/material";
import { useMemo } from "react";
import { Link, Navigate, Outlet, useLocation, useParams } from "react-router-dom";
import { useLeagueSeasons, useSeason } from "../api/queries";
import EmptyState from "../components/common/EmptyState";
import QueryBoundary from "../components/common/QueryBoundary";
import { buildSeasonContext, SeasonContext } from "../contexts/SeasonContext";
import { leaguePath } from "../routes";

const missingSeason = (what: string) => (
  <EmptyState
    title={`${what} not found`}
    description="It may not exist, or you may not have access to it."
    action={
      <Button component={Link} to="/" variant="outlined">
        Go to your leagues
      </Button>
    }
  />
);

const SeasonLoader = ({ seasonId, current }: { seasonId: number; current: boolean }) => {
  const query = useSeason(seasonId);
  const value = useMemo(
    () => (query.data ? buildSeasonContext(query.data, current) : null),
    [query.data, current],
  );
  return (
    <QueryBoundary query={query} what="this season" page>
      {() => (
        <SeasonContext.Provider value={value}>
          <Outlet />
        </SeasonContext.Provider>
      )}
    </QueryBoundary>
  );
};

/**
 * Resolves `/leagues/:leagueId/...` (the league's current season) and
 * `/leagues/:leagueId/seasons/:year/...` (any season) to a season and provides it to the pages
 * below. The long form of the current season redirects to the clean one.
 */
const SeasonLayout = () => {
  const { leagueId, year } = useParams<{ leagueId: string; year?: string }>();
  const location = useLocation();
  const seasons = useLeagueSeasons(leagueId);
  return (
    <QueryBoundary query={seasons} what="this league" page>
      {(list) => {
        const summary =
          year === undefined
            ? list.find((season) => season.current)
            : list.find((season) => String(season.year) === year);
        if (!summary)
          return missingSeason(year === undefined ? "The current season" : `The ${year} season`);
        if (year !== undefined && summary.current) {
          const rest = location.pathname.slice(
            `${leaguePath(leagueId ?? "")}/seasons/${year}`.length,
          );
          return (
            <Navigate
              to={{
                pathname: `${leaguePath(leagueId ?? "")}${rest}`,
                search: location.search,
                hash: location.hash,
              }}
              replace
            />
          );
        }
        return <SeasonLoader seasonId={summary.id} current={summary.current} />;
      }}
    </QueryBoundary>
  );
};

export default SeasonLayout;
