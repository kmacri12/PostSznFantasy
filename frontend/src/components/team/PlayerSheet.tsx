import { Alert, Box, ButtonBase, Drawer, Skeleton, Typography } from "@mui/material";
import { usePlayerSeasonLine } from "../../api/queries";
import type { LineupPlayer, RoundLineup } from "../../api/types";
import { tokens } from "../../theme";
import InjuryTag from "../common/InjuryTag";
import { formatPoints } from "../league/standingsView";
import { formatKickoff, type Move, ROUND_LABELS } from "./lineup";
import { slotNames } from "./lineupView";
import { type MoveOption, moveOptions } from "./moves";
import { seasonRows } from "./seasonLines";

/** The day and time of the game, or where it stands once it is on. */
const gameWhen = (player: LineupPlayer): string => {
  if (player.status === "bye") return "Bye week";
  if (player.gameState === "live") return player.gameClock ? `Live ${player.gameClock}` : "Live";
  if (player.gameState === "final") return "Final";
  return player.kickoff ? formatKickoff(player.kickoff) : "Game not scheduled yet";
};

const placement = (lineup: RoundLineup, player: LineupPlayer): string => {
  const slot = lineup.slots.find((entry) => entry.player?.id === player.id);
  if (player.status === "eliminated") return "eliminated";
  if (!slot || slot.slot === "BENCH") return "bench";
  return `starting at ${slotNames(lineup).get(slot.index)}`;
};

const StatBox = ({ rows }: { rows: { label: string; value: string }[] }) => (
  <Box sx={{ border: `1px solid ${tokens.border}`, borderRadius: 3, overflow: "hidden" }}>
    {rows.map((row, index) => (
      <Box
        key={row.label}
        sx={{
          display: "flex",
          justifyContent: "space-between",
          gap: 2,
          px: 1.5,
          py: 1,
          fontSize: 13,
          borderTop: index === 0 ? 0 : `1px solid ${tokens.border}`,
        }}
      >
        <Box component="span" sx={{ color: tokens.muted }}>
          {row.label}
        </Box>
        <Box component="b" sx={{ fontWeight: 600, textAlign: "right" }}>
          {row.value}
        </Box>
      </Box>
    ))}
  </Box>
);

const MoveRow = ({
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

interface Props {
  player: LineupPlayer;
  lineup: RoundLineup;
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

/** Bottom sheet from a player's name: the round's line, season stats and tap-only lineup moves. */
const PlayerSheet = ({
  player,
  lineup,
  canMove,
  canOverride,
  ownTeam,
  pending,
  error,
  onMove,
  onClose,
}: Props) => {
  const season = usePlayerSeasonLine(player.id);
  const started = player.gameState === "live" || player.gameState === "final";
  const rows = season.data ? seasonRows(player.position, season.data) : [];
  const options = canMove ? moveOptions(lineup, player, canOverride) : [];
  const where = [
    player.position,
    player.teamAbv || "FA",
    placement(lineup, player),
    ROUND_LABELS[lineup.round],
  ];

  return (
    <Drawer
      anchor="bottom"
      open
      onClose={onClose}
      slotProps={{
        paper: {
          "aria-label": player.name,
          sx: {
            maxWidth: 560,
            mx: "auto",
            width: "100%",
            borderRadius: "20px 20px 0 0",
            bgcolor: tokens.surface,
            borderTop: `1px solid ${tokens.borderStrong}`,
            backgroundImage: "none",
            px: 2,
            pt: 1.25,
            pb: "max(20px, env(safe-area-inset-bottom))",
            display: "flex",
            flexDirection: "column",
            gap: 1.5,
            maxHeight: "90vh",
          },
        },
      }}
    >
      <Box sx={{ width: 40, height: 4, borderRadius: 1, bgcolor: "#3a4046", mx: "auto" }} />
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography
            component="h2"
            sx={{ fontSize: 18, fontWeight: 700, overflowWrap: "anywhere" }}
          >
            {player.name}
          </Typography>
          <Typography component="span" sx={{ fontSize: 12, color: tokens.muted }}>
            {where.join(" · ")}
          </Typography>
          <InjuryTag status={player.injuryStatus} />
        </Box>
        <Box sx={{ ml: "auto", textAlign: "right", flexShrink: 0 }}>
          <Typography sx={{ fontSize: 24, fontWeight: 700, lineHeight: 1.2 }}>
            {player.status === "eliminated" ? "-" : formatPoints(player.points ?? 0)}
          </Typography>
          <Typography component="span" sx={{ fontSize: 12, color: tokens.muted }}>
            {gameWhen(player)}
          </Typography>
        </Box>
      </Box>

      <Box>
        {season.isPending ? (
          <Skeleton variant="rounded" height={64} />
        ) : (
          <>
            {season.data && (
              <Typography sx={{ fontSize: 12, color: tokens.muted, mb: 0.75 }}>
                {season.data.season} regular season
              </Typography>
            )}
            <StatBox
              rows={[
                ...(started && player.statLine
                  ? [{ label: "This round", value: player.statLine }]
                  : []),
                ...(rows.length > 0
                  ? rows
                  : [{ label: "Regular season", value: "No stats on record" }]),
              ]}
            />
          </>
        )}
      </Box>

      {player.status === "eliminated" && (
        <Typography sx={{ fontSize: 13, color: tokens.dangerMuted }}>
          His team is out, so he can't start this round.
        </Typography>
      )}
      {canMove && options.length > 0 && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <Typography sx={{ fontSize: 12, color: tokens.muted }}>
            {ownTeam ? "Move in your lineup" : "Move in this lineup"}
          </Typography>
          {options.map((option) => (
            <MoveRow key={option.key} option={option} disabled={pending} onMove={onMove} />
          ))}
        </Box>
      )}
      {error && <Alert severity="error">{error}</Alert>}
    </Drawer>
  );
};

export default PlayerSheet;
