import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { Alert, Box, ButtonBase, Collapse, Typography } from "@mui/material";
import { useState } from "react";
import type { LineupPlayer, RoundLineup } from "../../api/types";
import { tokens } from "../../theme";
import { formatPoints } from "../league/standingsView";
import { formatKickoff, type Move, ROUND_LABELS } from "./lineup";
import { postseasonLines, slotNames } from "./lineupView";
import { type MoveOption, moveOptions } from "./moves";
import { PlayerDrawer, Postseason, RegularSeason, ThisGame } from "./PlayerStats";

/** The day and time of the game, or where it stands once it is on. */
const gameWhen = (player: LineupPlayer): string => {
  if (player.status === "bye") return "Bye week";
  if (player.gameState === "live") return player.gameClock ?? "Live";
  if (player.gameState === "final") return "Final";
  return player.kickoff ? formatKickoff(player.kickoff) : "Game not scheduled yet";
};

const placement = (lineup: RoundLineup, player: LineupPlayer): string => {
  const slot = lineup.slots.find((entry) => entry.player?.id === player.id);
  if (player.status === "eliminated") return "eliminated";
  if (!slot || slot.slot === "BENCH") return "bench";
  return `starting at ${slotNames(lineup).get(slot.index)}`;
};

export const MoveRow = ({
  option,
  disabled,
  onMove,
}: {
  option: MoveOption;
  disabled: boolean;
  onMove: (move: Move) => void;
}) => {
  const off = option.move === null;
  return (
    <ButtonBase
      disabled={off || disabled}
      onClick={() => option.move && onMove(option.move)}
      sx={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 2,
        minHeight: 52,
        px: 1.75,
        py: 1,
        textAlign: "left",
        borderRadius: 3,
        border: `1px solid ${off ? tokens.borderStrong : tokens.accent}`,
        bgcolor: off ? "transparent" : tokens.accentSurface,
        opacity: off ? 0.55 : 1,
        color: tokens.text,
      }}
    >
      <Box component="span">
        <Box component="span" sx={{ display: "block", fontSize: 14, fontWeight: 600 }}>
          {option.title}
        </Box>
        <Box
          component="span"
          sx={{ display: "block", fontSize: 12, color: tokens.muted, mt: 0.125 }}
        >
          {option.detail}
        </Box>
      </Box>
      <Box component="span" sx={{ fontSize: 13, color: off ? tokens.muted : tokens.accent }}>
        {option.action}
      </Box>
    </ButtonBase>
  );
};

/**
 * The moves of a sheet: the ones anybody may make up top, and a commissioner's overrides
 * (moves that touch a locked player) folded under "Commissioner actions", closed on opening so
 * nobody taps one by accident. Picking an override still asks the server, and so the member, to
 * confirm.
 */
export const MoveList = ({
  title,
  options,
  disabled,
  onMove,
}: {
  title?: string;
  options: MoveOption[];
  disabled: boolean;
  onMove: (move: Move) => void;
}) => {
  const [showOverrides, setShowOverrides] = useState(false);
  const regular = options.filter((option) => option.action !== "Override");
  const overrides = options.filter((option) => option.action === "Override");
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {title && regular.length > 0 && (
        <Typography sx={{ fontSize: 12, color: tokens.muted }}>{title}</Typography>
      )}
      {regular.map((option) => (
        <MoveRow key={option.key} option={option} disabled={disabled} onMove={onMove} />
      ))}
      {overrides.length > 0 && (
        <>
          <ButtonBase
            aria-expanded={showOverrides}
            onClick={() => setShowOverrides((open) => !open)}
            sx={{
              justifyContent: "space-between",
              minHeight: 44,
              mt: regular.length > 0 ? 1 : 0,
              px: 0.5,
              borderRadius: 2,
              color: tokens.muted,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Commissioner actions ({overrides.length})
            <ExpandMoreIcon
              fontSize="small"
              sx={{
                transform: showOverrides ? "rotate(180deg)" : "none",
                transition: "transform .2s",
              }}
            />
          </ButtonBase>
          <Collapse in={showOverrides} unmountOnExit>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {overrides.map((option) => (
                <MoveRow key={option.key} option={option} disabled={disabled} onMove={onMove} />
              ))}
            </Box>
          </Collapse>
        </>
      )}
    </Box>
  );
};

interface Props {
  player: LineupPlayer;
  lineup: RoundLineup;
  /** Every round of the team, for the player's earlier postseason games. */
  lineups: RoundLineup[];
  /** Tap-to-move is offered: an editable team and a round that is not over. */
  canMove: boolean;
  /** A commissioner may pick locked players too; the server asks them to confirm. */
  canOverride: boolean;
  /** Reads "this lineup" for a commissioner on someone else's team. */
  ownTeam: boolean;
  pending: boolean;
  error: string | null;
  onMove: (move: Move) => void;
  onClose: () => void;
}

/**
 * Bottom sheet from a player's row: everything about him in one place. This game (stat line and
 * how the points were made), earlier postseason games, the regular season, then lineup moves.
 */
const PlayerSheet = ({
  player,
  lineup,
  lineups,
  canMove,
  canOverride,
  ownTeam,
  pending,
  error,
  onMove,
  onClose,
}: Props) => {
  const started = player.gameState === "live" || player.gameState === "final";
  const options = canMove ? moveOptions(lineup, player, canOverride) : [];
  return (
    <PlayerDrawer
      name={player.name}
      position={player.position}
      teamAbv={player.teamAbv ?? null}
      details={[placement(lineup, player), ROUND_LABELS[lineup.round] ?? ""]}
      injuryStatus={player.injuryStatus}
      points={player.status === "eliminated" ? "-" : formatPoints(player.points ?? 0)}
      when={gameWhen(player)}
      onClose={onClose}
    >
      {started && (
        <ThisGame
          game={{
            round: lineup.round,
            statLine: player.statLine,
            points: player.points ?? 0,
            // An API from before the breakdown sends none.
            breakdown: player.pointsBreakdown ?? [],
            multiplier: lineup.multiplier ?? 1,
          }}
        />
      )}
      <Postseason games={postseasonLines(lineups, player.id, lineup.round)} />
      <RegularSeason playerId={player.id} position={player.position} />

      {player.status === "eliminated" && (
        <Typography sx={{ fontSize: 13, color: tokens.dangerMuted }}>
          The player's team is out, so they can't start this round.
        </Typography>
      )}
      {canMove && options.length > 0 && (
        <MoveList
          title={ownTeam ? "Move in your lineup" : "Move in this lineup"}
          options={options}
          disabled={pending}
          onMove={onMove}
        />
      )}
      {error && <Alert severity="error">{error}</Alert>}
    </PlayerDrawer>
  );
};

export default PlayerSheet;
