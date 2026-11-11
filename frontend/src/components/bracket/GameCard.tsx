import { Box, Typography } from "@mui/material";
import type { BracketGame, BracketTeam } from "../../api/types";
import { radii, tokens } from "../../theme";
import { gameStatusText, matchupTitle, myPlayersSummary, winnerId } from "./bracketView";

interface TeamRowProps {
  team: BracketTeam | null;
  points: number | null;
  /** Dim the loser of a final game. */
  lost: boolean;
  won: boolean;
}

const TeamRow = ({ team, points, lost, won }: TeamRowProps) => (
  <Box
    sx={{
      display: "flex",
      alignItems: "center",
      gap: 1,
      minHeight: 28,
      opacity: lost ? 0.55 : 1,
    }}
  >
    <Typography
      component="span"
      sx={{ fontSize: 15, fontWeight: won ? 700 : 600, minWidth: 40, flex: "none" }}
    >
      {team?.abbreviation ?? "TBD"}
    </Typography>
    <Typography
      component="span"
      noWrap
      sx={{ fontSize: 13, color: tokens.muted, flex: 1, minWidth: 0 }}
    >
      {team ? team.name : "To be decided"}
    </Typography>
    {points !== null && (
      <Typography
        component="span"
        sx={{ fontSize: 15, fontWeight: won ? 700 : 500, fontVariantNumeric: "tabular-nums" }}
      >
        {points}
      </Typography>
    )}
  </Box>
);

interface Props {
  game: BracketGame;
  onOpen: () => void;
}

/** One matchup. The whole card is the tap target that opens the game's players. */
const GameCard = ({ game, onOpen }: Props) => {
  const winner = winnerId(game);
  const mine = myPlayersSummary(game);
  const live = game.state === "live";
  return (
    <Box
      component="button"
      type="button"
      onClick={onOpen}
      aria-label={`${matchupTitle(game)}, ${gameStatusText(game)}. Show players`}
      sx={{
        display: "block",
        width: "100%",
        minHeight: 44,
        boxSizing: "border-box",
        p: 1.5,
        textAlign: "left",
        font: "inherit",
        color: tokens.text,
        cursor: "pointer",
        bgcolor: tokens.surface,
        border: `1px solid ${live ? tokens.live : tokens.border}`,
        borderRadius: `${radii.card}px`,
      }}
    >
      <TeamRow
        team={game.away}
        points={game.awayPoints}
        won={winner !== null && winner === game.away?.id}
        lost={winner !== null && winner !== game.away?.id}
      />
      <TeamRow
        team={game.home}
        points={game.homePoints}
        won={winner !== null && winner === game.home?.id}
        lost={winner !== null && winner !== game.home?.id}
      />
      <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, mt: 0.75 }}>
        <Typography
          sx={{
            fontSize: 12,
            color: live ? tokens.liveSoft : tokens.muted,
            fontWeight: live ? 600 : 400,
          }}
        >
          {gameStatusText(game)}
        </Typography>
        {mine && (
          <Typography sx={{ fontSize: 12, color: tokens.accentSoft, textAlign: "right" }}>
            Yours: {mine}
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export default GameCard;
