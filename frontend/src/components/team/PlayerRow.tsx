import { Box, ButtonBase, Typography } from "@mui/material";
import type { LineupPlayer, SlotMark } from "../../api/types";
import { tokens } from "../../theme";
import ChangedScore from "../activity/ChangedScore";
import SlotMarker from "../activity/SlotMarker";
import InjuryTag from "../common/InjuryTag";
import TeamUnitBadge from "../common/TeamUnitBadge";
import { formatPoints } from "../league/standingsView";
import { playerDetail, type RowState, rowState } from "./lineupView";

const COLORS: Record<RowState, { label: string; name: string; detail: string; points: string }> = {
  ready: { label: "#fff", name: tokens.text, detail: tokens.muted, points: tokens.text },
  live: {
    label: tokens.accent,
    name: tokens.accent,
    detail: tokens.accent,
    points: tokens.accent,
  },
  done: { label: tokens.muted, name: tokens.text, detail: tokens.muted, points: tokens.text },
  eliminated: {
    label: tokens.muted,
    name: tokens.redSoft,
    detail: tokens.dangerMuted,
    points: tokens.redSoft,
  },
};

interface Props {
  /** The slot name for a starter, the position for a bench or eliminated player. */
  label: string;
  player: LineupPlayer | null;
  /** A benched player's name and score are muted. */
  bench?: boolean;
  mark?: SlotMark | null;
  onOpen: (player: LineupPlayer) => void;
}

/** One lineup line. The whole left side opens the player sheet; the score stays its own target. */
const PlayerRow = ({ label, player, bench = false, mark = null, onOpen }: Props) => {
  const state = player ? rowState(player) : "ready";
  const colors = COLORS[state];
  const muted = bench && state === "ready";
  const eliminated = state === "eliminated";
  return (
    <Box component="li" sx={{ borderTop: `1px solid ${tokens.border}` }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          bgcolor: eliminated ? tokens.dangerSurface : "transparent",
        }}
      >
        <ButtonBase
          component="div"
          disabled={!player}
          aria-label={player ? `${label} ${player.name}` : undefined}
          onClick={player ? () => onOpen(player) : undefined}
          sx={{
            flex: 1,
            minWidth: 0,
            minHeight: 56,
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start",
            gap: 1.25,
            py: 1.25,
            pl: 1.75,
            pr: 0.5,
            textAlign: "left",
          }}
        >
          <Typography
            component="span"
            sx={{
              width: 34,
              flexShrink: 0,
              fontSize: 12,
              textAlign: "center",
              color: player ? colors.label : tokens.muted,
            }}
          >
            {label}
          </Typography>
          {player ? (
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography
                noWrap
                component="span"
                sx={{
                  display: "block",
                  fontSize: 14,
                  fontWeight: 600,
                  color: muted ? tokens.muted : colors.name,
                  textDecoration: eliminated ? "line-through" : "none",
                }}
              >
                {player.name}
              </Typography>
              <Typography
                component="span"
                sx={{ display: "block", fontSize: 12, mt: 0.125, color: colors.detail }}
              >
                {playerDetail(player)}
              </Typography>
              <InjuryTag status={player.injuryStatus} />
              {player.scoresWholeTeam && (
                <TeamUnitBadge position={player.position} teamAbv={player.teamAbv} />
              )}
            </Box>
          ) : (
            <Typography component="span" sx={{ fontSize: 14, color: tokens.muted }}>
              Empty
            </Typography>
          )}
        </ButtonBase>
        <Box sx={{ pr: 1.75, pl: 0.5, minWidth: 52, textAlign: "right" }}>
          {player?.scoreChange ? (
            <ChangedScore
              points={player.points}
              change={player.scoreChange}
              unit={false}
              bold
              size={17}
              color={muted ? tokens.muted : colors.points}
            />
          ) : (
            <Typography
              component="span"
              sx={{
                fontSize: 17,
                fontWeight: 700,
                color: muted ? tokens.muted : colors.points,
              }}
            >
              {eliminated || !player ? "-" : formatPoints(player.points ?? 0)}
            </Typography>
          )}
        </Box>
      </Box>
      {mark && <SlotMarker mark={mark} empty={player === null} />}
    </Box>
  );
};

export default PlayerRow;
