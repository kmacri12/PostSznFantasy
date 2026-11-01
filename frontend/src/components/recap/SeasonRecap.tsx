import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { Link, useNavigate } from "react-router-dom";
import { useStartSeason } from "../../api/queries";
import type { AwardWinner, SeasonRecap as Recap } from "../../api/types";
import { seasonPaths } from "../../routes";
import { tokens } from "../../theme";
import { mutationError } from "../common/friendlyError";

const ROUND_NAMES = ["Wild Card", "Divisional", "Conference Championship", "Super Bowl"];

const points = (value: number) => `${Number(value.toFixed(2))} pts`;

const POSITIONS = ["QB", "RB", "WR", "TE", "K", "DST"];

const isDraftAward = (award: AwardWinner) => award.draftedAs !== null;

const awardValue = (award: AwardWinner): string => {
  if (isDraftAward(award)) {
    const places = Math.abs(award.value);
    const verb = award.value >= 0 ? "+" : "-";
    return `Drafted as ${award.position}${award.draftedAs}, finished ${award.position}${award.finishedAs}, ${verb}${places} ${places === 1 ? "place" : "places"} · ${points(award.points ?? 0)}`;
  }
  const round = award.round ? ` · ${ROUND_NAMES[award.round - 1]}` : "";
  return `${points(award.value)}${round}`;
};

const AwardCard = ({ award }: { award: AwardWinner }) => (
  <Card sx={{ p: 2 }} component="li" aria-label={award.title}>
    <Typography variant="overline" color="text.secondary">
      {award.title}
    </Typography>
    <Typography variant="h6" sx={{ overflowWrap: "anywhere" }}>
      {award.playerName ?? award.teamName}
      {award.position && (
        <Typography component="span" color="text.secondary">
          {" "}
          · {award.position}
        </Typography>
      )}
    </Typography>
    <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
      {award.playerName ? `${award.teamName} (${award.owner}) · ` : `${award.owner} · `}
      {awardValue(award)}
    </Typography>
  </Card>
);

const AwardGrid = ({ awards }: { awards: AwardWinner[] }) => (
  <Box
    component="ul"
    sx={{
      listStyle: "none",
      m: 0,
      p: 0,
      display: "grid",
      gap: 1.5,
      gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" },
    }}
  >
    {awards.map((award) => (
      <AwardCard key={award.key} award={award} />
    ))}
  </Box>
);

/** Best value and bust per position; open by default on desktop, collapsed on a phone. */
const DraftAwards = ({ awards }: { awards: AwardWinner[] }) => {
  const theme = useTheme();
  const wide = useMediaQuery(theme.breakpoints.up("md"));
  return (
    <Accordion defaultExpanded={wide} disableGutters>
      <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 48 }}>
        <Typography variant="h6">Draft value by position</Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {POSITIONS.map((position) => {
          const group = awards.filter((a) => a.key.endsWith(`_${position.toLowerCase()}`));
          return (
            group.length > 0 && (
              <Box key={position}>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                  {position}
                </Typography>
                <AwardGrid awards={group} />
              </Box>
            )
          );
        })}
      </AccordionDetails>
    </Accordion>
  );
};

const StartSeason = ({ leagueId, year }: { leagueId: number; year: number }) => {
  const navigate = useNavigate();
  const startSeason = useStartSeason(leagueId);
  const failure = mutationError(startSeason.error, "Couldn't start the season. Try again.");
  return (
    <Box>
      <Typography sx={{ mb: 1 }}>Season over: start {year}</Typography>
      <Button
        variant="contained"
        sx={{ minHeight: 44 }}
        disabled={startSeason.isPending}
        onClick={() =>
          startSeason.mutate(undefined, {
            onSuccess: () => navigate(seasonPaths(leagueId, year).home),
          })
        }
      >
        Start {year} season
      </Button>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        Starts the next season in this league with the same members, teams and settings, fresh
        rosters and an empty draft.
      </Typography>
      {failure && (
        <Alert severity="error" sx={{ mt: 1 }}>
          {failure}
        </Alert>
      )}
    </Box>
  );
};

/** A finished season's top: champion(s), awards, and the way on to the next season. */
const SeasonRecap = ({
  recap,
  canStartSeason,
}: {
  recap: Recap;
  /** The caller is a commissioner and no later season exists yet. */
  canStartSeason: boolean;
}) => (
  <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
    <Card sx={{ p: { xs: 2.5, md: 4 }, textAlign: "center", border: `1px solid ${tokens.gold}` }}>
      <EmojiEventsIcon sx={{ fontSize: 48, color: tokens.gold }} />
      <Typography variant="overline" color="text.secondary" sx={{ display: "block" }}>
        {recap.year} champion{recap.champions.length > 1 ? "s" : ""}
      </Typography>
      {recap.champions.map((champion) => (
        <Box key={champion.teamId} sx={{ my: 1 }}>
          <Typography variant="h4" sx={{ overflowWrap: "anywhere" }}>
            {champion.teamName}
          </Typography>
          <Typography color="text.secondary">
            {champion.owner} · {points(champion.total)}
          </Typography>
        </Box>
      ))}
    </Card>
    {recap.awards.length > 0 && (
      <Box>
        <Typography variant="h6" sx={{ mb: 1 }}>
          Season awards
        </Typography>
        <AwardGrid awards={recap.awards.filter((a) => !isDraftAward(a))} />
      </Box>
    )}
    {recap.awards.some(isDraftAward) && <DraftAwards awards={recap.awards.filter(isDraftAward)} />}
    {canStartSeason ? (
      <StartSeason leagueId={recap.leagueId} year={recap.year + 1} />
    ) : (
      recap.nextSeasonId !== null && (
        <Button
          component={Link}
          to={seasonPaths(recap.leagueId, recap.year + 1).home}
          sx={{ minHeight: 44 }}
        >
          Go to the {recap.year + 1} season
        </Button>
      )
    )}
  </Box>
);

export default SeasonRecap;
