import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { Accordion, AccordionDetails, AccordionSummary, Box, Typography } from "@mui/material";
import type { BreakdownPlayer, BreakdownRound, TeamBreakdown } from "../../api/types";
import { tokens } from "../../theme";
import { ROUND_NAMES } from "../league/standingsView";

const points = (value: number): string => String(Math.round(value * 100) / 100);

/** The round to open first: the latest one that has put any points on the board. */
export const openRound = (rounds: BreakdownRound[]): number =>
  [...rounds].reverse().find((round) => round.counted > 0 || round.benchPoints > 0)?.round ?? 1;

const PlayerLine = ({
  label,
  player,
  value,
  muted = false,
}: {
  label: string;
  player: BreakdownPlayer | null;
  value: number;
  muted?: boolean;
}) => (
  <Box
    component="li"
    sx={{
      display: "flex",
      alignItems: "center",
      gap: 1.5,
      minHeight: 44,
      py: 0.5,
      borderTop: `1px solid ${tokens.border}`,
      color: muted || !player ? "text.secondary" : "text.primary",
    }}
  >
    <Typography
      variant="caption"
      sx={{ width: 64, flexShrink: 0, textTransform: "uppercase", letterSpacing: 0.4 }}
    >
      {label}
    </Typography>
    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
      {player ? (
        <>
          <Typography noWrap sx={{ fontWeight: muted ? 400 : 600 }}>
            {player.name}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap component="div">
            {player.position}
            {player.teamAbv ? ` · ${player.teamAbv}` : ""}
          </Typography>
        </>
      ) : (
        <Typography sx={{ fontStyle: "italic" }}>Empty</Typography>
      )}
    </Box>
    <Typography sx={{ fontWeight: muted ? 400 : 700, fontVariantNumeric: "tabular-nums" }}>
      {points(value)}
    </Typography>
  </Box>
);

const RoundSection = ({ round, expanded }: { round: BreakdownRound; expanded: boolean }) => (
  <Accordion defaultExpanded={expanded} disableGutters>
    <AccordionSummary
      expandIcon={<ExpandMoreIcon />}
      sx={{ minHeight: 56, "& .MuiAccordionSummary-content": { alignItems: "center", gap: 1.5 } }}
    >
      <Typography sx={{ fontWeight: 700, flexGrow: 1 }}>
        {ROUND_NAMES[round.round - 1]}
        {round.multiplier !== 1 && (
          <Typography component="span" variant="caption" color="text.secondary">
            {" "}
            · {round.multiplier}x
          </Typography>
        )}
      </Typography>
      <Typography sx={{ color: tokens.gold, fontWeight: 800, whiteSpace: "nowrap" }}>
        {points(round.counted)} pts
      </Typography>
    </AccordionSummary>
    <AccordionDetails sx={{ pt: 0 }}>
      <Typography variant="overline" color="text.secondary" component="div">
        Starters · counted
      </Typography>
      <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0 }}>
        {round.starters.map((slot) => (
          <PlayerLine key={slot.index} label={slot.slot} player={slot.player} value={slot.points} />
        ))}
      </Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", mt: 1.5 }}>
        <Typography variant="overline" color="text.secondary" component="div">
          Bench · not counted
        </Typography>
        <Typography variant="overline" color="text.secondary" component="div">
          {points(round.benchPoints)} left on the bench
        </Typography>
      </Box>
      {round.bench.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No bench player scored.
        </Typography>
      ) : (
        <Box component="ul" aria-label="Bench points" sx={{ listStyle: "none", m: 0, p: 0 }}>
          {round.bench.map((player) => (
            <PlayerLine
              key={player.playerId}
              label={player.slot === null ? "Not placed" : "Bench"}
              player={player}
              value={player.points}
              muted
            />
          ))}
        </Box>
      )}
    </AccordionDetails>
  </Accordion>
);

/** Every round's counted points, starter by starter, with the bench's points muted below. */
const BreakdownRounds = ({ breakdown }: { breakdown: TeamBreakdown }) => {
  const open = openRound(breakdown.rounds);
  return (
    <Box>
      <Box
        sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5, mb: 2 }}
        aria-label="Totals"
        role="group"
      >
        <Box>
          <Typography variant="caption" color="text.secondary" component="div">
            Total points
          </Typography>
          <Typography variant="h5" sx={{ color: tokens.gold }}>
            {points(breakdown.total)}
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary" component="div">
            Left on the bench
          </Typography>
          <Typography variant="h5">{points(breakdown.pointsLeftOnBench)}</Typography>
        </Box>
      </Box>
      {breakdown.rounds.map((round) => (
        <RoundSection key={round.round} round={round} expanded={round.round === open} />
      ))}
    </Box>
  );
};

export default BreakdownRounds;
