import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import { Alert, Box, Button, Card, Typography } from "@mui/material";
import { Link, useNavigate } from "react-router-dom";
import { useRunItBack } from "../../api/queries";
import type { AwardWinner, SeasonRecap as Recap } from "../../api/types";
import { tokens } from "../../theme";
import { mutationError } from "../common/friendlyError";

const ROUND_NAMES = ["Wild Card", "Divisional", "Conference Championship", "Super Bowl"];

const points = (value: number) => `${Number(value.toFixed(2))} pts`;

const awardValue = (award: AwardWinner): string => {
  if (award.key === "draft_value" || award.key === "bust") {
    const places = Math.abs(award.value);
    return `${places} ${places === 1 ? "pick" : "picks"} ${award.value >= 0 ? "above" : "below"} the draft slot`;
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

const RunItBack = ({ leagueId }: { leagueId: number }) => {
  const navigate = useNavigate();
  const runItBack = useRunItBack(leagueId);
  const failure = mutationError(runItBack.error, "Couldn't start next season. Try again.");
  return (
    <Box>
      <Button
        variant="contained"
        sx={{ minHeight: 44 }}
        disabled={runItBack.isPending}
        onClick={() =>
          runItBack.mutate(undefined, {
            onSuccess: (data) => navigate(`/league/${data.leagueId}`),
          })
        }
      >
        Run it back
      </Button>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        Creates next season's league with the same members, teams and settings, fresh rosters and an
        empty draft.
      </Typography>
      {failure && (
        <Alert severity="error" sx={{ mt: 1 }}>
          {failure}
        </Alert>
      )}
    </Box>
  );
};

/** The finished league's top: champion(s), awards, and the run-it-back action. */
const SeasonRecap = ({
  recap,
  isCommissioner,
  nextLeagueId,
}: {
  recap: Recap;
  isCommissioner: boolean;
  nextLeagueId: number | null;
}) => (
  <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
    <Card sx={{ p: { xs: 2.5, md: 4 }, textAlign: "center", border: `1px solid ${tokens.gold}` }}>
      <EmojiEventsIcon sx={{ fontSize: 48, color: tokens.gold }} />
      <Typography variant="overline" color="text.secondary" sx={{ display: "block" }}>
        {recap.season} champion{recap.champions.length > 1 ? "s" : ""}
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
          {recap.awards.map((award) => (
            <AwardCard key={award.key} award={award} />
          ))}
        </Box>
      </Box>
    )}
    {isCommissioner &&
      (nextLeagueId ? (
        <Button component={Link} to={`/league/${nextLeagueId}`} sx={{ minHeight: 44 }}>
          Go to next season's league
        </Button>
      ) : (
        <RunItBack leagueId={recap.leagueId} />
      ))}
  </Box>
);

export default SeasonRecap;
