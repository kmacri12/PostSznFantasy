import { Box, Button, Chip, Container, Link as MuiLink, Typography } from "@mui/material";
import { Link } from "react-router-dom";
import { useStandings, useUserLeagues } from "../../api/queries";
import type { LeagueByUser } from "../../api/types";
import { useUser } from "../../contexts/UserContext";
import EmptyState from "../common/EmptyState";
import ErrorState from "../common/ErrorState";
import { friendlyError } from "../common/friendlyError";
import LoadingState from "../common/LoadingState";
import InviteCodeForm from "./InviteCodeForm";
import LeagueCard from "./LeagueCard";
import LegalFooter from "./LegalFooter";
import { phaseTag } from "./leagueSummary";
import PastLeagues from "./PastLeagues";

/**
 * The playoff round, once beside the heading: every league plays the same NFL weekend, so the round
 * is read from the first league whose draft is done and season is not over.
 */
const CurrentRound = ({ leagues }: { leagues: LeagueByUser[] }) => {
  const playing = leagues.find((league) => league.draftStatus === "completed" && !league.finished);
  const standings = useStandings(playing?.seasonId);
  if (!playing || !standings.data) return null;
  const tag = phaseTag(playing, standings.data, null);
  return (
    <Chip
      label={tag.label}
      color="primary"
      variant={tag.live ? "filled" : "outlined"}
      sx={{ flexShrink: 0 }}
    />
  );
};

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
      {/* The round sits beside the heading, not under it, to keep the cards high on a phone. */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1.5,
          mb: 2,
        }}
      >
        <Typography variant="h5" component="h1">
          {none ? "Welcome to PostSzn" : "Your leagues"}
        </Typography>
        <CurrentRound leagues={leagues.data} />
      </Box>
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
