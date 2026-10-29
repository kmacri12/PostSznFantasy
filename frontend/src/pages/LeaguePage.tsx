import { Container, Typography } from "@mui/material";
import type React from "react";
import { useParams } from "react-router-dom";
import StandingsTable from "../components/league/StandingsTable";

const LeaguePage: React.FC = () => {
  const { leagueId } = useParams<{ leagueId: string }>();

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Standings
      </Typography>
      {leagueId && <StandingsTable leagueId={leagueId} />}
    </Container>
  );
};

export default LeaguePage;
