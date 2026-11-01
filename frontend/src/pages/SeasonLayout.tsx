import { Button } from "@mui/material";
import { useMemo } from "react";
import { Link, Outlet, useParams } from "react-router-dom";
import { useLeagueSeasons, useSeason } from "../api/queries";
import EmptyState from "../components/common/EmptyState";
import QueryBoundary from "../components/common/QueryBoundary";
import { buildSeasonContext, SeasonContext } from "../contexts/SeasonContext";

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

const SeasonLoader = ({ seasonId }: { seasonId: number }) => {
  const query = useSeason(seasonId);
  const value = useMemo(() => (query.data ? buildSeasonContext(query.data) : null), [query.data]);
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

/** Resolves `/leagues/:leagueId/seasons/:year` to a season and provides it to the pages below. */
const SeasonLayout = () => {
  const { leagueId, year } = useParams<{ leagueId: string; year: string }>();
  const seasons = useLeagueSeasons(leagueId);
  return (
    <QueryBoundary query={seasons} what="this league" page>
      {(list) => {
        const summary = list.find((season) => String(season.year) === year);
        return summary ? (
          <SeasonLoader seasonId={summary.id} />
        ) : (
          missingSeason(`The ${year} season`)
        );
      }}
    </QueryBoundary>
  );
};

export default SeasonLayout;
