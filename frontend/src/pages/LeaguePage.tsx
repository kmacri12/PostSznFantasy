import React from "react";
import { useParams } from "react-router-dom";
import StandingsTable from "../components/league/StandingsTable";

const LeaguePage: React.FC = () => {
  const { leagueId } = useParams<{ leagueId: string }>();

  return (
    <div>
      <h1>League Page</h1>
      {leagueId && <StandingsTable leagueId={leagueId} />}
    </div>
  );
};

export default LeaguePage;
