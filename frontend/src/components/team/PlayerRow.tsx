import { Box, ButtonBase, Typography } from "@mui/material";
import { useState } from "react";
import type { LineupPlayer, SlotMark } from "../../api/types";
import type { HelpTipCopy } from "../../content/rules";
import { tokens } from "../../theme";
import ChangedScore from "../activity/ChangedScore";
import SlotMarker from "../activity/SlotMarker";
import HelpTip from "../common/HelpTip";
import InjuryTag from "../common/InjuryTag";
import { positionChipSx, positionColor } from "../draft/positions";
import { formatPoints } from "../league/standingsView";
import { nameWithTeam, playerDetail, type RowState, rowState } from "./lineupView";
import PointsBreakdownSheet from "./PointsBreakdownSheet";

const COLORS: Record<RowState, { label: string; name: string; detail: string; points: string }> = {
  ready: { label: tokens.text, name: tokens.text, detail: tokens.muted, points: tokens.text },
  live: {
    label: tokens.live,
    name: tokens.live,
    detail: tokens.live,
    points: tokens.live,
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
  /** A "?" about the slot itself, beside the score (team QB / team K). */
  help?: HelpTipCopy;
  onOpen: (player: LineupPlayer) => void;
  /** Makes an empty row tappable: opens the list of bench players who can fill it. */
  onFillEmpty?: () => void;
  /** The round shown and its multiplier: makes the score open its breakdown. */
  scoring?: { round: number; multiplier: number };
}

/** One lineup line. The whole left side opens the player sheet; the score stays its own target. */
const PlayerRow = ({
  label,
  player,
  bench = false,
  mark = null,
  help,
  onOpen,
  onFillEmpty,
  scoring,
}: Props) => {
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const state = player ? rowState(player) : "ready";
  const colors = COLORS[state];
  const muted = bench && state === "ready";
  const eliminated = state === "eliminated";
  const canBreakDown = Boolean(
    scoring && player && !eliminated && (player.pointsBreakdown ?? []).length > 0,
  );
  const score = (
    <Typography
      component="span"
      sx={{ fontSize: 17, fontWeight: 700, color: muted ? tokens.muted : colors.points }}
    >
      {eliminated || !player ? "-" : formatPoints(player.points ?? 0)}
    </Typography>
  );
  return (
    <Box component="li" sx={{ borderTop: `1px solid ${tokens.border}` }}>
      <Box
        sx={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          bgcolor: eliminated ? tokens.dangerSurface : "transparent",
          borderLeft: `4px solid ${player && !eliminated ? positionColor(player.position) : "transparent"}`,
        }}
      >
        <ButtonBase
          component="div"
          disabled={!player && !onFillEmpty}
          aria-label={
            player
              ? `${label} ${player.name}`
              : onFillEmpty
                ? `${label} empty, choose a player`
                : undefined
          }
          onClick={player ? () => onOpen(player) : onFillEmpty}
          sx={{
            flex: 1,
            minWidth: 0,
            // Every row is the same height whatever it shows: injury, mark and badges are
            // inline, and a "?" sits under the slot label.
            height: 64,
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start",
            gap: 1.25,
            pl: 1.75,
            // Room for the commissioner gavel beside the points.
            pr: mark ? 6.5 : 0.5,
            textAlign: "left",
          }}
        >
          <Typography
            component="span"
            sx={{
              width: 34,
              flexShrink: 0,
              ...(help ? { alignSelf: "flex-start", mt: 1.25 } : {}),
              fontSize: 12,
              textAlign: "center",
              color: player ? colors.label : tokens.muted,
              ...(!eliminated
                ? { ...positionChipSx(player ? player.position : label), px: 0, py: 0.25 }
                : {}),
            }}
          >
            {label}
          </Typography>
          {player ? (
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
                <Typography
                  noWrap
                  component="span"
                  sx={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: muted ? tokens.muted : colors.name,
                    textDecoration: eliminated ? "line-through" : "none",
                  }}
                >
                  {nameWithTeam(player)}
                </Typography>
                <InjuryTag status={player.injuryStatus} compact />
              </Box>
              <Typography
                noWrap
                component="span"
                sx={{ display: "block", fontSize: 12, mt: 0.125, color: colors.detail }}
              >
                {playerDetail(player)}
              </Typography>
            </Box>
          ) : (
            <>
              <Typography component="span" sx={{ fontSize: 14, color: tokens.muted }}>
                Empty
              </Typography>
              {onFillEmpty && (
                <Typography
                  component="span"
                  sx={{ ml: "auto", fontSize: 13, color: tokens.accent }}
                >
                  Choose
                </Typography>
              )}
            </>
          )}
        </ButtonBase>
        {help && (
          <Box sx={{ position: "absolute", left: 9, bottom: 0, zIndex: 1 }}>
            <HelpTip {...help} />
          </Box>
        )}
        {mark && (
          <Box sx={{ position: "absolute", right: 60, top: 10, zIndex: 1 }}>
            <SlotMarker mark={mark} empty={player === null} />
          </Box>
        )}
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
          ) : canBreakDown ? (
            <ButtonBase
              aria-haspopup="dialog"
              // Starts with the visible score, so a spoken "tap 1.7" still finds it.
              aria-label={`${formatPoints(player?.points ?? 0)} points, how they were scored`}
              onClick={() => setBreakdownOpen(true)}
              sx={{ minWidth: 44, minHeight: 44, justifyContent: "flex-end", borderRadius: 1 }}
            >
              {score}
            </ButtonBase>
          ) : (
            score
          )}
        </Box>
      </Box>
      {breakdownOpen && player && scoring && (
        <PointsBreakdownSheet
          player={player}
          round={scoring.round}
          multiplier={scoring.multiplier}
          onClose={() => setBreakdownOpen(false)}
        />
      )}
    </Box>
  );
};

export default PlayerRow;
