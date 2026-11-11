import { Box, Typography } from "@mui/material";
import { useState } from "react";
import type { Bracket, BracketGame } from "../../api/types";
import { tokens } from "../../theme";
import { ROUND_LABELS } from "../team/lineup";
import { waitingText } from "./bracketView";
import GameCard from "./GameCard";
import GameSheet from "./GameSheet";

/**
 * Rounds from Wild Card to Super Bowl: stacked on a phone, four columns from `md` up so the
 * bracket reads left to right. Nothing scrolls sideways.
 */
const BracketView = ({ bracket }: { bracket: Bracket }) => {
  const [open, setOpen] = useState<BracketGame | null>(null);
  return (
    <>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(4, minmax(0, 1fr))" },
          gap: { xs: 2.5, md: 2 },
          alignItems: "start",
        }}
      >
        {bracket.rounds.map(({ round, games }) => (
          <Box
            key={round}
            component="section"
            aria-labelledby={`round-${round}`}
            // Later rounds sit lower in the tree on desktop, between the games feeding them.
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 1,
              justifyContent: "center",
              alignSelf: { md: "stretch" },
            }}
          >
            <Typography
              id={`round-${round}`}
              component="h2"
              sx={{
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: 0.4,
                color: round === bracket.currentRound ? tokens.accentSoft : tokens.muted,
              }}
            >
              {ROUND_LABELS[round]}
              {round === bracket.currentRound ? " · now" : ""}
            </Typography>
            {games.length === 0 && (
              <Typography sx={{ fontSize: 13, color: tokens.muted }}>
                {waitingText(round)}
              </Typography>
            )}
            {games.map((game, i) => (
              <GameCard key={game.id ?? `${round}-${i}`} game={game} onOpen={() => setOpen(game)} />
            ))}
            {round === 1 && bracket.byes.length > 0 && (
              <Typography sx={{ fontSize: 13, color: tokens.muted }}>
                Bye: {bracket.byes.map((t) => t.abbreviation).join(", ")}
              </Typography>
            )}
          </Box>
        ))}
      </Box>
      {open && <GameSheet game={open} onClose={() => setOpen(null)} />}
    </>
  );
};

export default BracketView;
