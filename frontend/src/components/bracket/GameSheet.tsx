import { Box, Typography } from "@mui/material";
import { useGamePlayers } from "../../api/queries";
import type { BracketGame, GamePlayer, GameSide } from "../../api/types";
import { useSeasonContext } from "../../contexts/SeasonContext";
import { tokens } from "../../theme";
import { friendlyError } from "../common/friendlyError";
import TeamLogo from "../common/TeamLogo";
import { positionChipSx } from "../draft/positions";
import { formatPoints } from "../league/standingsView";
import SettingsSheet from "../settings/SettingsSheet";
import { gameStatusText, matchupTitle, shortPlayerName } from "./bracketView";

/**
 * Two lines so two teams fit side by side on a phone: position, short name and points, then the
 * fantasy team underneath ("Not drafted" when nobody has him); the viewer's own players in accent.
 */
const PlayerCell = ({ player }: { player: GamePlayer }) => (
  <Box component="li" sx={{ listStyle: "none", py: 0.75, borderTop: `1px solid ${tokens.border}` }}>
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
      <Box
        component="span"
        sx={{
          ...positionChipSx(player.position),
          fontSize: 11,
          minWidth: 30,
          px: 0,
          py: 0.125,
          textAlign: "center",
          flex: "none",
        }}
      >
        {player.position}
      </Box>
      <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600 }}>
        {shortPlayerName(player)}
      </Typography>
      <Typography sx={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
        {player.points === null ? "-" : formatPoints(player.points)}
      </Typography>
    </Box>
    <Typography
      noWrap
      sx={{
        fontSize: 12,
        mt: 0.25,
        pl: "38px",
        color: player.mine ? tokens.accent : tokens.muted,
        fontWeight: player.mine ? 700 : 400,
      }}
    >
      {player.fantasyTeam ?? "Not drafted"}
    </Typography>
  </Box>
);

const SideColumn = ({ side }: { side: GameSide }) => (
  <Box sx={{ minWidth: 0 }}>
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.5 }}>
      <TeamLogo abbreviation={side.team.abbreviation} size={18} />
      <Typography component="h3" sx={{ fontSize: 15, fontWeight: 700, flex: 1 }}>
        {side.team.abbreviation}
      </Typography>
      {side.points !== null && (
        <Typography sx={{ fontSize: 15, fontWeight: 700 }}>{side.points}</Typography>
      )}
    </Box>
    {side.players.length > 0 ? (
      <Box component="ul" sx={{ m: 0, p: 0 }} aria-label={`${side.team.abbreviation} players`}>
        {side.players.map((player) => (
          <PlayerCell key={player.id} player={player} />
        ))}
      </Box>
    ) : (
      <Typography sx={{ fontSize: 13, color: tokens.muted }}>No one drafted yet.</Typography>
    )}
  </Box>
);

const Players = ({ game }: { game: BracketGame & { id: string } }) => {
  const { seasonId } = useSeasonContext();
  const players = useGamePlayers(seasonId, game.id);
  if (players.isLoading) {
    return <Typography sx={{ fontSize: 13, color: tokens.muted }}>Loading players…</Typography>;
  }
  if (!players.data) {
    return (
      <Typography role="alert" sx={{ fontSize: 13, color: tokens.muted }}>
        {friendlyError(players.error, "Couldn't load this game's players. Try again.")}
      </Typography>
    );
  }
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
      <SideColumn side={players.data.away} />
      <SideColumn side={players.data.home} />
    </Box>
  );
};

/** A schedule game as a stat page: each side's players with this game's fantasy points. */
const GameSheet = ({ game, onClose }: { game: BracketGame; onClose: () => void }) => (
  <SettingsSheet title={matchupTitle(game)} onClose={onClose} closeLabel="Close">
    <Typography sx={{ fontSize: 14, color: tokens.textSoft }}>
      {gameStatusText(game)}
      {game.homePoints !== null && game.awayPoints !== null
        ? ` · ${game.away?.abbreviation ?? "TBD"} ${game.awayPoints}, ${game.home?.abbreviation ?? "TBD"} ${game.homePoints}`
        : ""}
    </Typography>
    {game.id && game.home && game.away ? (
      <Players game={{ ...game, id: game.id }} />
    ) : (
      <Typography sx={{ fontSize: 13, color: tokens.muted }}>
        The teams are not decided yet.
      </Typography>
    )}
  </SettingsSheet>
);

export default GameSheet;
