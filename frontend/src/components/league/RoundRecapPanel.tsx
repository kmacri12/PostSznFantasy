import { Box, Typography } from "@mui/material";
import type { RoundHighlight } from "../../api/types";
import { tokens } from "../../theme";
import Logo from "../common/Logo";
import RecapRow from "./RecapRow";
import { recapTitle } from "./roundRecap";

/**
 * The whole recap on one phone screen, built to be screenshotted: the logo, the round, the league,
 * every highlight, the address. The share button draws the same thing as a picture
 * (`share/renderCard.ts`).
 */
const RoundRecapPanel = ({
  leagueName,
  round,
  highlights,
}: {
  leagueName: string;
  round: number;
  highlights: RoundHighlight[];
}) => (
  <Box
    sx={{
      display: "flex",
      flexDirection: "column",
      gap: 1.5,
      px: 2.5,
      py: 1.5,
      "@media (max-height: 740px)": { gap: 1, py: 1 },
    }}
  >
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1.25 }}>
      <Logo variant="lockup" size={32} />
      <Box sx={{ textAlign: "center" }}>
        <Typography
          sx={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", color: tokens.gold }}
        >
          {recapTitle(round).toUpperCase()}
        </Typography>
        <Typography component="h2" sx={{ fontSize: 24, fontWeight: 800, overflowWrap: "anywhere" }}>
          {leagueName}
        </Typography>
      </Box>
    </Box>
    <Box
      component="ul"
      sx={{
        m: 0,
        p: 0,
        display: "flex",
        flexDirection: "column",
        gap: 0.9,
        "@media (max-height: 740px)": { gap: 0.6 },
      }}
    >
      {highlights.map((highlight) => (
        <RecapRow key={highlight.kind} highlight={highlight} />
      ))}
    </Box>
    <Typography sx={{ fontSize: 12, color: tokens.muted, textAlign: "center" }}>
      postsznfantasy.com
    </Typography>
  </Box>
);

export default RoundRecapPanel;
