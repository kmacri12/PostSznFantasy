import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import {
  Box,
  Button,
  Card,
  Chip,
  Container,
  Grid,
  Link as MuiLink,
  Skeleton,
  Typography,
} from "@mui/material";
import { Link, useNavigate } from "react-router-dom";
import { useDraft, usePastLeagues, useStandings, useStartSeason } from "../api/queries";
import type { LeagueByUser, SeasonSummary } from "../api/types";
import { mutationError } from "../components/common/friendlyError";
import JoinCodeBox from "../components/league/JoinCodeBox";
import { useUser } from "../contexts/UserContext";
import { leaguePath, seasonPaths } from "../routes";
import { tokens } from "../theme";
import { DormantNotice } from "./DormantPage";

const POSTSEASON_RULES = [
  {
    title: "Round multipliers",
    blurb: "Make the Super Bowl count triple: set a scoring multiplier for every round.",
  },
  {
    title: "Lineups every round",
    blurb: "Set a fresh lineup for each round from the players whose teams are still alive.",
  },
  {
    title: "Kickoff locks",
    blurb:
      "Each player locks at their own kickoff, so you can keep adjusting until their game starts.",
  },
  {
    title: "Tiebreakers",
    blurb:
      "Ties go to the latest round's score, then earlier rounds, then who holds the Super Bowl winner.",
  },
];

const ROUNDS = [
  { name: "Wild Card", blurb: "12 teams, 6 games. Roster the survivors." },
  { name: "Divisional", blurb: "8 teams left. Players on losing teams are gone." },
  { name: "Conference", blurb: "4 teams left. Every point is now rarer." },
  { name: "Super Bowl", blurb: "2 teams left. Last roster standing wins." },
];

/** Links to a league's earlier seasons, newest first. */
const PastSeasons = ({ leagueId, seasons }: { leagueId: number; seasons: SeasonSummary[] }) => (
  <Box sx={{ mt: 1.5 }}>
    <Typography variant="overline" color="text.secondary" component="h4">
      Past seasons
    </Typography>
    <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
      {[...seasons]
        .sort((a, b) => b.year - a.year)
        .map((season) => (
          <Button
            key={season.id}
            size="small"
            component={Link}
            to={seasonPaths(leagueId, season.year, season.current).home}
            sx={{ minHeight: 44 }}
          >
            {season.year}
          </Button>
        ))}
    </Box>
  </Box>
);

/** The finished season's next step: the commissioner starts the following one. */
const SeasonOver = ({ league }: { league: LeagueByUser }) => {
  const navigate = useNavigate();
  const startSeason = useStartSeason(league.id);
  const nextYear = league.season + 1;
  const failure = mutationError(startSeason.error, "Couldn't start the season. Try again.");
  return (
    <Box sx={{ mt: 1.5 }}>
      <Typography variant="body2" color="text.secondary">
        Season over: start {nextYear}
      </Typography>
      {league.isCommissioner ? (
        <Button
          variant="contained"
          size="small"
          sx={{ mt: 1, minHeight: 44 }}
          disabled={startSeason.isPending}
          onClick={() =>
            startSeason.mutate(undefined, {
              onSuccess: () => navigate(seasonPaths(league.id, nextYear, true).home),
            })
          }
        >
          Start {nextYear} season
        </Button>
      ) : (
        <Typography variant="body2" color="text.secondary">
          Your commissioner starts the {nextYear} season.
        </Typography>
      )}
      {failure && (
        <Typography variant="body2" color="error" role="alert">
          {failure}
        </Typography>
      )}
    </Box>
  );
};

const LeagueWidget = ({ league }: { league: LeagueByUser }) => {
  const standings = useStandings(league.seasonId);
  const draft = useDraft(league.seasonId);
  const pastSeasons = league.seasons.filter((season) => season.id !== league.seasonId);
  const loaded = !standings.isLoading && !draft.isLoading && !standings.isError;
  const rows = standings.data?.teams ?? [];
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
          <Chip size="small" variant="outlined" label={`${league.season} season`} />
          {league.finished && <Chip size="small" variant="outlined" label="Season over" />}
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
        <Button size="small" component={Link} to={leaguePath(league.id)}>
          League
        </Button>
        <Button
          size="small"
          component={Link}
          to={seasonPaths(league.id, league.season, true).draft}
        >
          Draft room
        </Button>
      </Box>
      {league.finished && <SeasonOver league={league} />}
      {pastSeasons.length > 0 && <PastSeasons leagueId={league.id} seasons={pastSeasons} />}
    </Card>
  );
};

/** Leagues the member left: the finished seasons they played in stay readable. */
const PastLeagues = () => {
  const { data: pastLeagues = [] } = usePastLeagues(true);
  if (pastLeagues.length === 0) return null;
  return (
    <Box sx={{ mt: 6 }}>
      <Typography variant="h5" component="h2" sx={{ mb: 2 }}>
        Leagues you left
      </Typography>
      <Grid container spacing={2}>
        {pastLeagues.map((league) => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={league.id}>
            <Card sx={{ p: 2.5, height: "100%" }}>
              <Typography variant="h6" noWrap>
                {league.name}
              </Typography>
              <PastSeasons leagueId={league.id} seasons={league.seasons} />
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

const LandingPage = ({
  leagues,
  dormant = false,
}: {
  leagues: LeagueByUser[];
  dormant?: boolean;
}) => {
  const { user, signIn } = useUser();

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 4, md: 8 } }}>
      <Box sx={{ textAlign: "center", maxWidth: 760, mx: "auto" }}>
        {dormant ? (
          <DormantNotice />
        ) : (
          <>
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
              Playoff fantasy with cascading elimination: when an NFL team loses, its players are
              out for good. Build a roster that keeps scoring while everyone else's disappears.
            </Typography>
          </>
        )}

        {!dormant && (
          <Box
            sx={{ display: "flex", gap: 1.5, justifyContent: "center", flexWrap: "wrap", mt: 4 }}
          >
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
                    to={leaguePath(leagues[0]?.id ?? "")}
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
        )}
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

      {user && <PastLeagues />}

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
      <Box
        component="footer"
        sx={{ mt: 8, display: "flex", gap: 3, justifyContent: "center", flexWrap: "wrap" }}
      >
        <MuiLink component={Link} to="/privacy" color="text.secondary" sx={{ py: 1.5 }}>
          Privacy
        </MuiLink>
        <MuiLink component={Link} to="/terms" color="text.secondary" sx={{ py: 1.5 }}>
          Terms
        </MuiLink>
      </Box>
    </Container>
  );
};

export default LandingPage;
