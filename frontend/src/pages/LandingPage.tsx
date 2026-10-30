import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { Box, Button, Card, Chip, Container, Grid, Skeleton, Typography } from "@mui/material";
import { Link } from "react-router-dom";
import { useDraft, useStandings } from "../api/queries";
import type { LeagueByUser } from "../api/types";
import JoinCodeBox from "../components/league/JoinCodeBox";
import { useUser } from "../contexts/UserContext";
import { tokens } from "../theme";

const POSTSEASON_RULES = [
  {
    title: "Round multipliers",
    blurb: "Make the Super Bowl count triple: set a scoring multiplier for every round.",
  },
  {
    title: "Free agency",
    blurb: "Allow pickups between rounds, or only swap out players whose teams are eliminated.",
  },
  {
    title: "Roster locks",
    blurb: "Lock lineups at the start of each round or at each player's kickoff.",
  },
  {
    title: "Tiebreakers & byes",
    blurb: "Decide ties by players alive or best round, and how bye-week teams are treated.",
  },
];

const ROUNDS = [
  { name: "Wild Card", blurb: "12 teams, 6 games. Roster the survivors." },
  { name: "Divisional", blurb: "8 teams left. Players on losing teams are gone." },
  { name: "Conference", blurb: "4 teams left. Every point is now rarer." },
  { name: "Super Bowl", blurb: "2 teams left. Last roster standing wins." },
];

const LeagueWidget = ({ league }: { league: LeagueByUser }) => {
  const standings = useStandings(league.id);
  const draft = useDraft(league.id);
  const loaded = !standings.isLoading && !draft.isLoading && !standings.isError;
  const rows = standings.data ?? [];
  const snapshot = loaded
    ? {
        rank: rows.find((row) => row.teamId === league.userTeamId)?.rank ?? null,
        teams: rows.length,
        draftStatus: draft.data?.status ?? null,
        draftStart: draft.data?.startTime ?? null,
      }
    : null;

  return (
    <Card sx={{ p: 2.5, height: "100%" }}>
      <Typography variant="h6" noWrap>
        {league.name}
      </Typography>
      {snapshot ? (
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", my: 1.5 }}>
          <Chip
            size="small"
            color={snapshot.rank ? "primary" : "default"}
            label={snapshot.rank ? `Rank #${snapshot.rank} of ${snapshot.teams}` : "Unranked"}
          />
          <Chip
            size="small"
            variant="outlined"
            label={
              snapshot.draftStatus === "scheduled" && snapshot.draftStart
                ? `Draft ${new Date(snapshot.draftStart).toLocaleString()}`
                : `Draft ${(snapshot.draftStatus ?? "pending").replace("_", " ")}`
            }
          />
        </Box>
      ) : standings.isError ? (
        <Typography variant="body2" color="text.secondary" sx={{ my: 1.5 }}>
          Couldn't load this league's standings.
        </Typography>
      ) : (
        <Skeleton width="70%" sx={{ my: 1.5 }} />
      )}
      <Box sx={{ display: "flex", gap: 1 }}>
        <Button size="small" component={Link} to={`/league/${league.id}`}>
          League
        </Button>
        <Button size="small" component={Link} to={`/league/${league.id}/draft`}>
          Draft room
        </Button>
      </Box>
    </Card>
  );
};

const LandingPage = ({ leagues }: { leagues: LeagueByUser[] }) => {
  const { user, signIn } = useUser();

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 4, md: 8 } }}>
      <Box sx={{ textAlign: "center", maxWidth: 760, mx: "auto" }}>
        <Chip
          label="NFL postseason only"
          sx={{ mb: 3, bgcolor: "rgba(251,191,36,.12)", color: tokens.gold }}
        />
        <Typography variant="h2" sx={{ fontSize: { xs: 40, md: 64 }, lineHeight: 1.05 }}>
          Draft once. <br />
          <Box
            component="span"
            sx={{
              background: `linear-gradient(135deg, ${tokens.gold}, #f97316)`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Survive every round.
          </Box>
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 3, fontSize: 18 }}>
          Playoff fantasy with cascading elimination: when an NFL team loses, its players are out
          for good. Build a roster that keeps scoring while everyone else's disappears.
        </Typography>

        <Box sx={{ display: "flex", gap: 1.5, justifyContent: "center", flexWrap: "wrap", mt: 4 }}>
          {user ? (
            <>
              <Button
                variant="contained"
                size="large"
                component={Link}
                to="/create-league"
                endIcon={<ArrowForwardIcon />}
              >
                Create a league
              </Button>
              {leagues.length > 0 && (
                <Button
                  variant="outlined"
                  size="large"
                  color="inherit"
                  component={Link}
                  to={`/league/${leagues[0]?.id}`}
                >
                  View your leagues
                </Button>
              )}
            </>
          ) : (
            <Button variant="contained" size="large" onClick={signIn}>
              Sign in to play
            </Button>
          )}
          <JoinCodeBox />
        </Box>
      </Box>

      {user && leagues.length > 0 && (
        <Box sx={{ mt: 8 }}>
          <Typography variant="h5" sx={{ mb: 2 }}>
            Your leagues
          </Typography>
          <Grid container spacing={2}>
            {leagues.map((league) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={league.id}>
                <LeagueWidget league={league} />
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      <Box sx={{ mt: 8 }}>
        <Typography variant="h5" component="h2" sx={{ mb: 2 }}>
          How it works
        </Typography>
        <Grid container spacing={2}>
          {ROUNDS.map((round, index) => (
            <Grid size={{ xs: 12, sm: 6, md: 3 }} key={round.name}>
              <Card sx={{ p: 2.5, height: "100%", position: "relative" }}>
                <Typography
                  sx={{
                    fontSize: 44,
                    fontWeight: 800,
                    color: "rgba(251,191,36,.25)",
                    lineHeight: 1,
                  }}
                >
                  {index + 1}
                </Typography>
                <Typography variant="h6" sx={{ mt: 1 }}>
                  {round.name}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {round.blurb}
                </Typography>
                {index < ROUNDS.length - 1 && (
                  <ArrowForwardIcon
                    sx={{
                      display: { xs: "none", md: "block" },
                      position: "absolute",
                      right: -18,
                      top: "50%",
                      color: tokens.muted,
                      zIndex: 1,
                    }}
                  />
                )}
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
      <Box sx={{ mt: 8 }}>
        <Typography variant="h5" sx={{ mb: 2 }}>
          Playoff rules you control
        </Typography>
        <Grid container spacing={2}>
          {POSTSEASON_RULES.map((rule) => (
            <Grid size={{ xs: 12, sm: 6, md: 3 }} key={rule.title}>
              <Card sx={{ p: 2.5, height: "100%" }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  {rule.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {rule.blurb}
                </Typography>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    </Container>
  );
};

export default LandingPage;
