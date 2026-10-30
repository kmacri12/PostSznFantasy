import { Box, Button, Container, Typography } from "@mui/material";
import type React from "react";
import { Link, useParams } from "react-router-dom";
import { useTeamBreakdown } from "../api/queries";
import DataFreshness from "../components/common/DataFreshness";
import QueryBoundary from "../components/common/QueryBoundary";
import BreakdownRounds from "../components/team/BreakdownRounds";

/** One fantasy team's points round by round, starters counted and the bench muted. */
const TeamPointsPage: React.FC = () => {
  const { teamId } = useParams<{ teamId: string }>();
  const query = useTeamBreakdown(teamId);
  return (
    <QueryBoundary query={query} what="this team's points" page>
      {(breakdown) => (
        <Container maxWidth="md" sx={{ py: { xs: 2, sm: 4 } }}>
          <Typography variant="h4" sx={{ overflowWrap: "anywhere" }}>
            {breakdown.teamName}
          </Typography>
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: 1, mb: 1 }}>
            <Button component={Link} to={`/league/${breakdown.leagueId}`}>
              Standings
            </Button>
            <Button component={Link} to={`/team/${breakdown.teamId}`}>
              Lineup
            </Button>
          </Box>
          <Box sx={{ mb: 2 }}>
            <DataFreshness />
          </Box>
          <BreakdownRounds breakdown={breakdown} />
        </Container>
      )}
    </QueryBoundary>
  );
};

export default TeamPointsPage;
