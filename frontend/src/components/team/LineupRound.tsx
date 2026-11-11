import { Box, Typography } from "@mui/material";
import type { ReactNode } from "react";
import type { LineupPlayer, RoundLineup } from "../../api/types";
import { tokens } from "../../theme";
import { formatPoints } from "../league/standingsView";
import {
  BENCH_GROUP_ID,
  benchPlayersOf,
  eliminatedLastRound,
  roundIsFinal,
  roundScore,
  slotLabel,
  startersOf,
  sumPoints,
} from "./lineupView";
import PlayerRow from "./PlayerRow";

const Group = ({
  id,
  title,
  total,
  prominent = false,
  danger = false,
  badge,
  children,
}: {
  id?: string;
  title: string;
  total: number | null;
  prominent?: boolean;
  danger?: boolean;
  badge?: ReactNode;
  children: ReactNode;
}) => (
  <Box
    component="section"
    id={id}
    aria-label={title}
    sx={{
      bgcolor: tokens.surface,
      border: `1px solid ${danger ? tokens.dangerBorder : tokens.border}`,
      borderRadius: 3.5,
      overflow: "hidden",
    }}
  >
    <Box
      sx={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 1,
        px: 1.75,
        py: 1.125,
        fontSize: 12,
        bgcolor: danger ? tokens.dangerHeader : tokens.surfaceRaised,
        color: danger ? tokens.redSoft : tokens.muted,
      }}
    >
      <Typography
        component="h2"
        sx={{ fontSize: 12, display: "flex", gap: 1, alignItems: "center" }}
      >
        {title}
        {badge}
      </Typography>
      <Typography
        component="span"
        sx={{
          fontSize: prominent ? 15 : 12,
          fontWeight: prominent ? 700 : 400,
          color: prominent ? tokens.text : "inherit",
        }}
      >
        {total === null ? "-" : formatPoints(total)}
      </Typography>
    </Box>
    <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0 }}>
      {children}
    </Box>
  </Box>
);

interface Props {
  lineup: RoundLineup;
  onOpenPlayer: (player: LineupPlayer) => void;
}

/** One round of a team: Starters, Bench, and who went out last round. */
const LineupRound = ({ lineup, onOpenPlayer }: Props) => {
  const bench = benchPlayersOf(lineup);
  const eliminated = eliminatedLastRound(lineup);
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "3fr 2fr" },
        gap: 2,
        alignItems: "start",
      }}
    >
      <Group
        title="Starters"
        total={roundScore(lineup)}
        prominent
        badge={
          roundIsFinal(lineup) && (
            <Box
              component="span"
              sx={{
                fontSize: 11,
                color: tokens.muted,
                border: `1px solid ${tokens.borderStrong}`,
                borderRadius: 5,
                px: 1,
                py: 0.25,
              }}
            >
              Final
            </Box>
          )
        }
      >
        {startersOf(lineup).map((slot) => (
          <PlayerRow
            key={slot.index}
            label={slotLabel(slot.slot)}
            player={slot.player}
            mark={slot.mark}
            onOpen={onOpenPlayer}
          />
        ))}
      </Group>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        {bench.length > 0 && (
          <Group id={BENCH_GROUP_ID} title="Bench" total={sumPoints(bench)}>
            {bench.map((player) => (
              <PlayerRow
                key={player.id}
                label={player.position}
                player={player}
                bench
                onOpen={onOpenPlayer}
              />
            ))}
          </Group>
        )}
        {eliminated.length > 0 && (
          <Group title="Eliminated" total={0} danger>
            {eliminated.map((player) => (
              <PlayerRow
                key={player.id}
                label={player.position}
                player={player}
                onOpen={onOpenPlayer}
              />
            ))}
          </Group>
        )}
      </Box>
    </Box>
  );
};

export default LineupRound;
