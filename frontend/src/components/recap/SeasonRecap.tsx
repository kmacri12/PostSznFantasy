import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { Alert, alpha, Box, Button, ButtonBase, Card, Tooltip, Typography } from "@mui/material";
import { Link, useNavigate } from "react-router-dom";
import { useStartSeason } from "../../api/queries";
import type { AwardWinner, SeasonRecap as Recap } from "../../api/types";
import { seasonPaths } from "../../routes";
import { tokens } from "../../theme";
import { mutationError } from "../common/friendlyError";
import { formatPoints } from "../league/standingsView";

const points = (value: number) => `${formatPoints(value)} pts`;

const POSITIONS = ["QB", "RB", "WR", "TE", "K", "DST"];

const POSITION_ROWS = [
  {
    prefix: "top",
    label: "Highest scoring",
    help: "Highest scoring: the player who scored the most fantasy points at his position this season.",
  },
  {
    prefix: "best_value",
    label: "Best value",
    help: "Best value: the player who finished furthest above where he was drafted, compared with the others at his position.",
  },
  {
    prefix: "bust",
    label: "Biggest bust",
    help: "Biggest bust: the player who finished furthest below where he was drafted, compared with the others at his position.",
  },
] as const;

const awardLine = (award: AwardWinner): string => {
  const pick = award.pickNumber !== null ? ` · Pick ${award.pickNumber}` : "";
  return `${award.playerName}${pick} · ${points(award.points ?? award.value)}`;
};

const ChampionCard = ({ recap }: { recap: Recap }) => (
  <Card
    sx={{
      p: 2,
      display: "flex",
      flexDirection: "column",
      gap: 1.5,
      border: `1px solid ${tokens.gold}`,
      bgcolor: alpha(tokens.gold, 0.1),
    }}
  >
    {recap.champions.map((champion) => (
      <Box
        key={champion.teamId}
        sx={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          columnGap: 1.5,
          alignItems: "center",
        }}
      >
        <Typography variant="caption" sx={{ color: tokens.gold }}>
          {recap.year} champion
        </Typography>
        <Typography
          sx={{
            gridColumn: 2,
            gridRow: "1 / span 3",
            fontSize: 30,
            fontWeight: 700,
            lineHeight: 1.1,
          }}
        >
          {formatPoints(champion.total)}
        </Typography>
        <Typography component="h2" sx={{ fontSize: 22, fontWeight: 700, overflowWrap: "anywhere" }}>
          {champion.teamName}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {champion.owner}
        </Typography>
      </Box>
    ))}
  </Card>
);

const HeadlineAward = ({ title, award }: { title: string; award: AwardWinner }) => (
  <Card sx={{ p: 1.5 }} component="li" aria-label={title}>
    <Typography variant="caption" color="text.secondary" component="div">
      {title}
    </Typography>
    <Typography sx={{ fontWeight: 600, overflowWrap: "anywhere" }}>{award.playerName}</Typography>
    <Typography variant="caption" sx={{ color: "success.main" }}>
      {points(award.value)}
    </Typography>
  </Card>
);

/** A row label that opens its explanation on a tap, hover or focus. */
const RowLabel = ({ label, help }: { label: string; help: string | null }) =>
  help ? (
    <Tooltip title={help} arrow enterTouchDelay={0} leaveTouchDelay={8000}>
      <ButtonBase
        aria-label={`${label}: what does this mean?`}
        sx={{
          minHeight: 44,
          gap: 0.75,
          color: "text.secondary",
          fontSize: 13,
          justifyContent: "flex-start",
        }}
      >
        {label}
        <InfoOutlinedIcon aria-hidden sx={{ fontSize: 16 }} />
      </ButtonBase>
    </Tooltip>
  ) : (
    <Typography
      color="text.secondary"
      sx={{ fontSize: 13, minHeight: 44, display: "flex", alignItems: "center" }}
    >
      {label}
    </Typography>
  );

const PositionAwards = ({ awards }: { awards: AwardWinner[] }) => {
  const groups = POSITIONS.map((position) => ({
    position,
    rows: POSITION_ROWS.map((row) => ({
      ...row,
      award: awards.find((a) => a.key === `${row.prefix}_${position.toLowerCase()}`),
    })),
  })).filter((group) => group.rows.some((row) => row.award));
  if (groups.length === 0) return null;
  return (
    <Card sx={{ p: 2, display: "flex", flexDirection: "column", gap: 1 }}>
      <Typography component="h3" sx={{ fontSize: 14, fontWeight: 700 }}>
        By position
      </Typography>
      {groups.map(({ position, rows }, groupIndex) => (
        <Box
          key={position}
          component="section"
          aria-label={position}
          sx={{ borderTop: 1, borderColor: "divider", pt: 1 }}
        >
          <Typography
            sx={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, color: "success.main" }}
          >
            {position}
          </Typography>
          {rows.map(({ label, help, award }) => (
            <Box
              key={label}
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 1,
              }}
            >
              <RowLabel label={label} help={groupIndex === 0 ? help : null} />
              <Typography
                sx={{ fontSize: 13, fontWeight: 600, textAlign: "right", overflowWrap: "anywhere" }}
              >
                {award ? awardLine(award) : "-"}
              </Typography>
            </Box>
          ))}
        </Box>
      ))}
    </Card>
  );
};

const Awards = ({ recap }: { recap: Recap }) => {
  const mvp = recap.awards.find((a) => a.key === "playoff_mvp");
  const championsMvp = recap.awards.find((a) => a.key === "champions_mvp");
  return (
    <Box
      component="section"
      aria-label="Awards"
      sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}
    >
      <Box sx={{ display: "flex", justifyContent: "space-between", px: 0.5 }}>
        <Typography component="h2" sx={{ fontSize: 14, fontWeight: 700 }}>
          Awards
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {recap.year} season
        </Typography>
      </Box>
      <Box
        component="ul"
        sx={{
          listStyle: "none",
          m: 0,
          p: 0,
          display: "grid",
          gap: 1,
          gridTemplateColumns: "1fr 1fr",
        }}
      >
        {mvp && <HeadlineAward title="Playoff MVP" award={mvp} />}
        {championsMvp && (
          <HeadlineAward title={`${championsMvp.teamName} MVP`} award={championsMvp} />
        )}
      </Box>
      <PositionAwards awards={recap.awards} />
    </Box>
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
            onSuccess: () => navigate(seasonPaths(leagueId, year, true).home),
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

/** A finished season's top: the champion, the awards, and the way on to the next season. */
const SeasonRecap = ({
  recap,
  canStartSeason,
}: {
  recap: Recap;
  /** The caller is a commissioner and no later season exists yet. */
  canStartSeason: boolean;
}) => (
  <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
    <ChampionCard recap={recap} />
    {recap.awards.length > 0 && <Awards recap={recap} />}
    {canStartSeason ? (
      <StartSeason leagueId={recap.leagueId} year={recap.year + 1} />
    ) : (
      recap.nextSeasonId !== null && (
        <Button
          component={Link}
          to={seasonPaths(recap.leagueId, recap.year + 1, true).home}
          sx={{ minHeight: 44 }}
        >
          Go to the {recap.year + 1} season
        </Button>
      )
    )}
  </Box>
);

export default SeasonRecap;
