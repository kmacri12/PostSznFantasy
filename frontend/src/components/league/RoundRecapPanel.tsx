import { Box, Typography, useMediaQuery } from "@mui/material";
import type { RoundHighlight, TeamScore } from "../../api/types";
import { tokens } from "../../theme";
import Logo from "../common/Logo";
import RecapRow from "./RecapRow";
import { recapTitle } from "./roundRecap";
import { formatPoints } from "./standingsView";

/** Short phones (an iPhone SE) still fit the whole recap, so the spacing tightens there. */
const SHORT = "@media (max-height: 740px)";

const WeekScores = ({ scores }: { scores: TeamScore[] }) => (
  <Box>
    <Typography
      sx={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: tokens.muted, mb: 0.5 }}
    >
      POINTS THIS WEEK
    </Typography>
    <Box
      component="ol"
      sx={{
        m: 0,
        p: 0,
        listStyle: "none",
        display: "grid",
        gridTemplateRows: `repeat(${Math.ceil(scores.length / 2)}, auto)`,
        gridAutoFlow: "column",
        gridTemplateColumns: "1fr 1fr",
        columnGap: 2,
        rowGap: 0.25,
        [SHORT]: { rowGap: 0 },
      }}
    >
      {scores.map((score, _, all) => (
        <Box
          component="li"
          key={score.teamId}
          sx={{ display: "flex", gap: 1, fontSize: 13, minWidth: 0, [SHORT]: { fontSize: 12 } }}
        >
          <Box component="span" sx={{ width: 16, color: tokens.muted, fontWeight: 700 }}>
            {all.findIndex((other) => other.points === score.points) + 1}
          </Box>
          <Box
            component="span"
            sx={{
              flex: 1,
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {score.teamName}
          </Box>
          <Box component="span" sx={{ fontWeight: 700 }}>
            {formatPoints(score.points)}
          </Box>
        </Box>
      ))}
    </Box>
  </Box>
);

/**
 * The whole recap on one phone screen, built to be screenshotted: the logo, the round and league on
 * one line, every highlight, every team's points, the address. The share button draws the same
 * thing as a picture (`share/renderCard.ts`).
 */
const RoundRecapPanel = ({
  leagueName,
  round,
  highlights,
  teamScores = [],
}: {
  leagueName: string;
  round: number;
  highlights: RoundHighlight[];
  teamScores?: TeamScore[];
}) => {
  const short = useMediaQuery("(max-height: 740px)");
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 1.25,
        px: 2.5,
        py: 1.5,
        [SHORT]: { gap: 0.5, py: 0.75 },
      }}
    >
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.75 }}>
        <Logo variant="lockup" size={short ? 34 : 40} />
        <Box
          component="h2"
          sx={{
            m: 0,
            maxWidth: "100%",
            display: "flex",
            alignItems: "baseline",
            justifyContent: "center",
            gap: 0.75,
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          <Box
            component="span"
            sx={{ flex: "none", fontWeight: 700, letterSpacing: "0.06em", color: tokens.gold }}
          >
            {recapTitle(round).toUpperCase()}
          </Box>
          <Box component="span" aria-hidden sx={{ color: tokens.muted }}>
            ·
          </Box>
          <Box
            component="span"
            sx={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          >
            {leagueName}
          </Box>
        </Box>
      </Box>
      <Box
        component="ul"
        sx={{
          m: 0,
          p: 0,
          display: "flex",
          flexDirection: "column",
          gap: 0.6,
          [SHORT]: { gap: 0.4 },
        }}
      >
        {highlights.map((highlight) => (
          <RecapRow key={highlight.kind} highlight={highlight} />
        ))}
      </Box>
      {teamScores.length > 0 && <WeekScores scores={teamScores} />}
      <Typography
        sx={{
          fontSize: 11,
          color: tokens.muted,
          textAlign: "center",
          [SHORT]: { display: "none" },
        }}
      >
        postsznfantasy.com
      </Typography>
    </Box>
  );
};

export default RoundRecapPanel;
