import { Box, Typography } from "@mui/material";
import { useState } from "react";
import type { Bracket, BracketGame } from "../../api/types";
import { tokens } from "../../theme";
import { ROUND_LABELS } from "../team/lineup";
import { waitingText } from "./bracketView";
import GameCard from "./GameCard";
import GameSheet from "./GameSheet";
import RoundTabs from "./RoundTabs";

const gameCount = (n: number): string => (n === 0 ? "-" : `${n} ${n === 1 ? "game" : "games"}`);

/**
 * One round at a time, picked with the same four tabs as the Team page. It opens on the round on
 * display (the League page's Wednesday midnight switch) and dashes the next round's tab once its games are
 * set. A column on a phone, a grid of games from `md` up. Nothing scrolls sideways.
 */
const BracketView = ({ bracket }: { bracket: Bracket }) => {
  const [round, setRound] = useState(bracket.currentRound);
  const [open, setOpen] = useState<BracketGame | null>(null);
  const games = bracket.rounds.find((entry) => entry.round === round)?.games ?? [];
  return (
    <>
      <RoundTabs
        round={round}
        onSelect={setRound}
        dashedRound={bracket.upcomingRound}
        cells={bracket.rounds.map((entry) => ({
          round: entry.round,
          value: gameCount(entry.games.length),
        }))}
      />
      <Box
        component="section"
        aria-label={ROUND_LABELS[round]}
        sx={{
          mt: 2,
          display: "grid",
          gridTemplateColumns: {
            xs: "minmax(0, 1fr)",
            md: "repeat(auto-fill, minmax(300px, 1fr))",
          },
          gap: 1,
          alignItems: "start",
        }}
      >
        {games.length === 0 && (
          <Typography sx={{ fontSize: 13, color: tokens.muted }}>{waitingText(round)}</Typography>
        )}
        {games.map((game, i) => (
          <GameCard key={game.id ?? `${round}-${i}`} game={game} onOpen={() => setOpen(game)} />
        ))}
      </Box>
      {round === 1 && bracket.byes.length > 0 && (
        <Typography sx={{ mt: 1.5, fontSize: 13, color: tokens.muted }}>
          Bye: {bracket.byes.map((t) => t.abbreviation).join(", ")}
        </Typography>
      )}
      {open && <GameSheet game={open} onClose={() => setOpen(null)} />}
    </>
  );
};

export default BracketView;
