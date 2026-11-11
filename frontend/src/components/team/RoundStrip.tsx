import { Box, ButtonBase } from "@mui/material";
import type { RoundLineup } from "../../api/types";
import { tokens } from "../../theme";
import { visuallyHidden } from "../common/visuallyHidden";
import { formatPoints, ROUNDS } from "../league/standingsView";
import { ROUND_LABELS } from "./lineup";
import { roundScore } from "./lineupView";

interface Props {
  lineups: RoundLineup[];
  round: number;
  onSelect: (round: number) => void;
}

/** Four cells, one per playoff round, each with that round's team score; the chosen one is outlined. */
const RoundStrip = ({ lineups, round, onSelect }: Props) => (
  <Box
    role="tablist"
    aria-label="Round"
    sx={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: { xs: 0.75, md: 1.25 } }}
  >
    {lineups.map((lineup) => {
      const selected = lineup.round === round;
      const score = roundScore(lineup);
      const short = ROUNDS[lineup.round - 1]?.label;
      const full = ROUND_LABELS[lineup.round];
      return (
        <ButtonBase
          key={lineup.round}
          role="tab"
          aria-selected={selected}
          onClick={() => onSelect(lineup.round)}
          sx={{
            display: "block",
            minHeight: 56,
            py: selected ? "7px" : "8px",
            textAlign: "center",
            borderRadius: "10px",
            border: selected ? `2px solid ${tokens.accent}` : `1px solid ${tokens.borderStrong}`,
            bgcolor: selected ? tokens.accentSurface : tokens.surface,
            fontSize: { xs: 16, md: 22 },
            fontWeight: { xs: 600, md: 700 },
            color: tokens.text,
          }}
        >
          <Box
            component="span"
            sx={{
              display: "block",
              fontSize: { xs: 10, md: 12 },
              fontWeight: 400,
              color: tokens.muted,
            }}
          >
            {short}
          </Box>
          {score === null ? "-" : formatPoints(score)}
          {/* After the visible text, so the spoken name starts with what the tab shows (WCAG 2.5.3). */}
          {full !== short && <Box component="span" sx={visuallyHidden}>{`, ${full}`}</Box>}
        </ButtonBase>
      );
    })}
  </Box>
);

export default RoundStrip;
