import { Skeleton, Typography } from "@mui/material";
import { usePlayerPostseason } from "../../api/queries";
import type { GamePlayer } from "../../api/types";
import { useSeasonContext } from "../../contexts/SeasonContext";
import { tokens } from "../../theme";
import { friendlyError } from "../common/friendlyError";
import { formatPoints } from "../league/standingsView";
import { PlayerDrawer, Postseason, RegularSeason, ThisGame } from "../team/PlayerStats";

/**
 * A player tapped in a schedule game: the same sheet as on the Team page, without lineup moves.
 * This game is the tapped game's round; Postseason lists his earlier rounds.
 */
const GamePlayerSheet = ({
  player,
  round,
  teamAbv,
  onClose,
}: {
  player: GamePlayer;
  round: number;
  teamAbv: string;
  onClose: () => void;
}) => {
  const { seasonId } = useSeasonContext();
  const games = usePlayerPostseason(seasonId, player.id);
  const lines = (games.data?.rounds ?? []).map((line) => ({
    round: line.round,
    statLine: line.statLine,
    points: line.points,
    breakdown: line.pointsBreakdown,
    multiplier: line.multiplier,
  }));
  const thisGame = lines.find((line) => line.round === round);
  const live = games.data?.rounds.find((line) => line.round === round);
  const earlier = lines.filter(
    (line) =>
      line.round < round &&
      games.data?.rounds.find((game) => game.round === line.round)?.state === "final",
  );
  const owner = player.fantasyTeam ?? "Not drafted";

  return (
    <PlayerDrawer
      name={player.name}
      position={player.position}
      teamAbv={teamAbv}
      details={[owner]}
      injuryStatus={games.data?.injuryStatus}
      points={
        thisGame
          ? formatPoints(thisGame.points)
          : player.points === null
            ? "-"
            : formatPoints(player.points)
      }
      when={
        live?.state === "live" ? (live.clock ?? "Live") : live?.state === "final" ? "Final" : ""
      }
      onClose={onClose}
    >
      {games.isPending ? (
        <Skeleton variant="rounded" height={96} />
      ) : games.isError ? (
        <Typography role="alert" sx={{ fontSize: 13, color: tokens.muted }}>
          {friendlyError(games.error, "Couldn't load his games. Try again.")}
        </Typography>
      ) : (
        <>
          {thisGame && <ThisGame game={thisGame} />}
          <Postseason games={earlier} />
        </>
      )}
      <RegularSeason playerId={player.id} position={player.position} />
    </PlayerDrawer>
  );
};

export default GamePlayerSheet;
