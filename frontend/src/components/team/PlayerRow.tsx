import { Box, ButtonBase, Typography } from "@mui/material";
import type { LineupPlayer, SlotMark } from "../../api/types";
import type { HelpTipCopy } from "../../content/rules";
import { tint, tokens } from "../../theme";
import ChangedScore from "../activity/ChangedScore";
import SlotMarker from "../activity/SlotMarker";
import HelpTip from "../common/HelpTip";
import InjuryTag from "../common/InjuryTag";
import TeamLogo from "../common/TeamLogo";
import { positionChipSx, positionColor } from "../draft/positions";
import { formatPoints } from "../league/standingsView";
import { type GameOutcome, gameOutcome, playerDetail, type RowState, rowState } from "./lineupView";

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

/** ADVANCES (green) or ELIMINATED (red) as a small outlined pill, in front of the score. */
const OutcomePill = ({ outcome }: { outcome: GameOutcome }) => {
  const color = outcome.won ? tokens.green : tokens.red;
  return (
    <Box
      component="span"
      sx={{
        display: "inline-block",
        px: 0.625,
        borderRadius: "5px",
        border: `1px solid ${tint(color, 35)}`,
        bgcolor: tint(color, 14),
        color,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 0.3,
        lineHeight: 1.5,
        verticalAlign: "1px",
      }}
    >
      {outcome.word}
    </Box>
  );
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
  /** The Super Bowl: a winner there is the champion, not "advancing". */
  superBowl?: boolean;
  onOpen: (player: LineupPlayer) => void;
  /** Makes an empty row tappable: opens the list of bench players who can fill it. */
  onFillEmpty?: () => void;
}

/** One lineup line. The whole row opens the player sheet, the score included. */
const PlayerRow = ({
  label,
  player,
  bench = false,
  mark = null,
  help,
  superBowl = false,
  onOpen,
  onFillEmpty,
}: Props) => {
  const state = player ? rowState(player) : "ready";
  const colors = COLORS[state];
  const muted = bench && state === "ready";
  const eliminated = state === "eliminated";
  const outcome = player ? gameOutcome(player, superBowl) : null;
  const open = player ? () => onOpen(player) : onFillEmpty;
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
          onClick={open}
          sx={{
            flex: 1,
            minWidth: 0,
            // Every row is the same height whatever it shows: injury, mark and badges are
            // inline, and a "?" sits under the slot label.
            height: 54,
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
              ...(help ? { alignSelf: "flex-start", mt: 0.5 } : {}),
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
                    textDecoration: eliminated || outcome?.won === false ? "line-through" : "none",
                    // A team that lost this round: the strike is red, the name keeps its colour.
                    textDecorationColor: outcome?.won === false ? tokens.red : undefined,
                    textDecorationThickness: outcome?.won === false ? "1.5px" : undefined,
                  }}
                >
                  {player.position === "DST" || !player.teamAbv ? (
                    <>
                      <TeamLogo abbreviation={player.teamAbv} size={14} />
                      {player.name}
                    </>
                  ) : (
                    <>
                      {player.name} · <TeamLogo abbreviation={player.teamAbv} size={14} />
                      {player.teamAbv}
                    </>
                  )}
                </Typography>
                <InjuryTag status={player.injuryStatus} compact />
              </Box>
              <Typography
                noWrap
                component="span"
                sx={{ display: "block", fontSize: 12, mt: 0.125, color: colors.detail }}
              >
                {outcome && (
                  <>
                    <OutcomePill outcome={outcome} />{" "}
                  </>
                )}
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
          <Box sx={{ position: "absolute", right: 60, top: 6, zIndex: 1 }}>
            <SlotMarker mark={mark} empty={player === null} />
          </Box>
        )}
        {/* Outside the button (a changed score is a button of its own and cannot nest in it), so it
            opens the same sheet itself; a tap on the score is a tap on the row. */}
        <Box
          onClick={open}
          sx={{
            alignSelf: "stretch",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            pr: 1.75,
            pl: 0.5,
            minWidth: 52,
            textAlign: "right",
            cursor: open ? "pointer" : "default",
          }}
        >
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
            score
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default PlayerRow;
