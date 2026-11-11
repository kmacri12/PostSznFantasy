import { Box, Button, Container, Link as MuiLink, Typography } from "@mui/material";
import { Link } from "react-router-dom";
import { useUserLeagues } from "../../api/queries";
import { useUser } from "../../contexts/UserContext";
import EmptyState from "../common/EmptyState";
import ErrorState from "../common/ErrorState";
import { friendlyError } from "../common/friendlyError";
import LoadingState from "../common/LoadingState";
import InviteCodeForm from "./InviteCodeForm";
import LeagueCard from "./LeagueCard";
import LegalFooter from "./LegalFooter";
import PastLeagues from "./PastLeagues";

/** The signed-in home: league cards first, then Create / Join / How to play. */
const YourLeagues = () => {
  const { userId, syncError } = useUser();
  const leagues = useUserLeagues(userId !== null);

  if (syncError) {
    return (
      <Container maxWidth="sm" sx={{ py: 4 }}>
        <ErrorState message={syncError} />
      </Container>
    );
  }
  if (leagues.isError) {
    return (
      <Container maxWidth="sm" sx={{ py: 4 }}>
        <ErrorState
          message={friendlyError(leagues.error, "Couldn't load your leagues.")}
          onRetry={() => leagues.refetch()}
        />
      </Container>
    );
  }
  if (!leagues.data) {
    return (
      <Container maxWidth="sm" sx={{ py: 4 }}>
        <LoadingState what="your leagues" rows={2} />
      </Container>
    );
  }
  const none = leagues.data.length === 0;

  return (
    <Container
      maxWidth="sm"
      sx={{
        py: { xs: 2.5, sm: 4 },
        display: "flex",
        flexDirection: "column",
        minHeight: "calc(100dvh - 64px)",
      }}
    >
      <Typography variant="h5" component="h1" sx={{ mb: 2 }}>
        {none ? "Welcome to PostSzn" : "Your leagues"}
      </Typography>
      {none && (
        <EmptyState
          illustration="leagues"
          title="No leagues yet"
          description="Start a league for your group, or join one with a code from your commissioner."
        />
      )}
      <Box sx={{ display: "grid", gap: 1.5 }}>
        {leagues.data.map((league) => (
          <LeagueCard key={league.id} league={league} />
        ))}
      </Box>
      <Box sx={{ display: "grid", gap: 1.5, mt: 3 }}>
        <Button
          component={Link}
          to="/create-league"
          variant={none ? "contained" : "outlined"}
          color={none ? "primary" : "inherit"}
          size="large"
        >
          Create a league
        </Button>
        <InviteCodeForm />
        <MuiLink
          component={Link}
          to="/how-to-play"
          underline="none"
          sx={{ textAlign: "center", py: 1.5, color: "primary.main" }}
        >
          Read how to play
        </MuiLink>
      </Box>
      <PastLeagues />
      <Box sx={{ mt: 3 }} />
      <LegalFooter />
    </Container>
  );
};

export default YourLeagues;
