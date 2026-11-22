import { Box, Typography } from "@mui/material";
import type { ReactNode } from "react";
import type { LineupPlayer, RoundLineup } from "../../api/types";
import { BENCH_EMPTY, ELIMINATED_EMPTY, HELP_TIPS, type HelpTipCopy } from "../../content/rules";
import { tokens } from "../../theme";
import HelpTip from "../common/HelpTip";
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
  help,
  children,
}: {
  id?: string;
  title: string;
  total: number | null;
  prominent?: boolean;
  danger?: boolean;
  badge?: ReactNode;
  help?: HelpTipCopy;
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
        {help && (
          <Box component="span" sx={{ my: -1.5, ml: -0.5 }}>
            <HelpTip {...help} />
          </Box>
        )}
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

/** The one row of a group with nobody in it, so the groups keep their place before the draft. */
const EmptyRow = ({ text }: { text: string }) => (
  <Box
    component="li"
    sx={{
      borderTop: `1px solid ${tokens.border}`,
      minHeight: 56,
      display: "flex",
      alignItems: "center",
      px: 1.75,
    }}
  >
    <Typography component="span" sx={{ fontSize: 14, color: tokens.muted }}>
      {text}
    </Typography>
  </Box>
);

export interface TeamUnits {
  qb: boolean;
  k: boolean;
}

interface Props {
  lineup: RoundLineup;
  /** Team QB / team K: those slots get a "?" saying they score the whole NFL team. */
  teamUnits?: TeamUnits;
  onOpenPlayer: (player: LineupPlayer) => void;
  /** Present when the lineup can be changed: empty starter rows open the slot picker. */
  onFillSlot?: (slotIndex: number) => void;
}

const slotHelp = (slot: string, units: TeamUnits | undefined): HelpTipCopy | undefined => {
  if (slot === "QB" && units?.qb) return HELP_TIPS.teamQb;
  if (slot === "K" && units?.k) return HELP_TIPS.teamK;
  return undefined;
};

/**
 * One round of a team: Starters, Bench, and who went out last round. The same groups show
 * before the draft, empty, as after it.
 */
const LineupRound = ({ lineup, teamUnits, onOpenPlayer, onFillSlot }: Props) => {
  const bench = benchPlayersOf(lineup);
  const eliminated = eliminatedLastRound(lineup);
  const scoring = { round: lineup.round, multiplier: lineup.multiplier ?? 1 };
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
        help={HELP_TIPS.lineupLocks}
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
            help={slotHelp(slot.slot, teamUnits)}
            onOpen={onOpenPlayer}
            onFillEmpty={slot.player || !onFillSlot ? undefined : () => onFillSlot(slot.index)}
            scoring={scoring}
          />
        ))}
      </Group>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        <Group id={BENCH_GROUP_ID} title="Bench" total={bench.length > 0 ? sumPoints(bench) : null}>
          {bench.length === 0 && <EmptyRow text={BENCH_EMPTY} />}
          {bench.map((player) => (
            <PlayerRow
              key={player.id}
              label={player.position}
              player={player}
              bench
              onOpen={onOpenPlayer}
              scoring={scoring}
            />
          ))}
        </Group>
        <Group title="Eliminated" total={0} danger help={HELP_TIPS.eliminated}>
          {eliminated.length === 0 && <EmptyRow text={ELIMINATED_EMPTY} />}
          {eliminated.map((player) => (
            <PlayerRow
              key={player.id}
              label={player.position}
              player={player}
              onOpen={onOpenPlayer}
            />
          ))}
        </Group>
      </Box>
    </Box>
  );
};

export default LineupRound;
