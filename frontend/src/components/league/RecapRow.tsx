import { Box, Typography } from "@mui/material";
import type { RoundHighlight } from "../../api/types";
import { tint, tokens } from "../../theme";
import { highlightLabel, highlightStyle } from "./roundRecap";

/** One recap line: an emoji badge, the label over the sentence, and the number set big. */
const RecapRow = ({
  highlight,
  compact = false,
}: {
  highlight: RoundHighlight;
  compact?: boolean;
}) => {
  const { emoji, tone } = highlightStyle(highlight);
  const color = tokens[tone];
  const badge = compact ? 30 : 40;
  return (
    <Box
      component="li"
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.25,
        px: compact ? 1 : 1.25,
        py: compact ? 0.75 : 1,
        // A short phone screen still fits the whole recap without scrolling.
        "@media (max-height: 740px)": compact ? undefined : { py: 0.5, gap: 1 },
        borderRadius: "12px",
        bgcolor: tokens.surface,
        border: `1px solid ${tokens.border}`,
        borderLeft: `3px solid ${color}`,
        listStyle: "none",
      }}
    >
      <Box
        aria-hidden
        sx={{
          flex: "none",
          width: badge,
          height: badge,
          borderRadius: "50%",
          display: "grid",
          placeItems: "center",
          fontSize: compact ? 15 : 20,
          bgcolor: tint(color, 18),
          "@media (max-height: 740px)": compact
            ? undefined
            : { width: 32, height: 32, fontSize: 16 },
        }}
      >
        {emoji}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0, textAlign: "left" }}>
        <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color }}>
          {highlightLabel(highlight).toUpperCase()}
        </Typography>
        <Typography
          sx={{
            fontSize: compact ? 13 : 14,
            fontWeight: 600,
            lineHeight: 1.2,
            "@media (max-height: 740px)": compact ? undefined : { fontSize: 13 },
          }}
        >
          {highlight.text}
        </Typography>
      </Box>
      {highlight.stat && (
        <Typography
          aria-hidden
          sx={{
            flex: "none",
            fontSize: compact ? 20 : 26,
            fontWeight: 800,
            color,
            lineHeight: 1,
            "@media (max-height: 740px)": compact ? undefined : { fontSize: 22 },
          }}
        >
          {highlight.stat}
        </Typography>
      )}
    </Box>
  );
};

export default RecapRow;
