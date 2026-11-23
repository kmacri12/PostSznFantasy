import { Box, ButtonBase } from "@mui/material";
import { tokens } from "../../theme";
import { visuallyHidden } from "../common/visuallyHidden";
import { ROUNDS } from "../league/standingsView";
import { ROUND_LABELS } from "../team/lineup";

export interface RoundTabCell {
  round: number;
  /** The line under the round's name: the team's score, the number of games. */
  value: string;
}

interface Props {
  cells: RoundTabCell[];
  round: number;
  onSelect: (round: number) => void;
}

/**
 * Four cells, one per playoff round, each with a value under its name; the chosen one is outlined
 * in the accent, like the Team page's `RoundStrip` (kept apart so the schedule never changes the
 * tour's Team screens).
 */
const RoundTabs = ({ cells, round, onSelect }: Props) => (
  <Box
    role="tablist"
    aria-label="Round"
    sx={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: { xs: 0.75, md: 1.25 } }}
  >
    {cells.map((cell) => {
      const selected = cell.round === round;
      const short = ROUNDS[cell.round - 1]?.label;
      const full = ROUND_LABELS[cell.round];
      return (
        <ButtonBase
          key={cell.round}
          role="tab"
          aria-selected={selected}
          onClick={() => onSelect(cell.round)}
          sx={{
            display: "block",
            minHeight: 48,
            py: selected ? "3px" : "4px",
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
          {cell.value}
          {/* After the visible text, so the spoken name starts with what the tab shows (WCAG 2.5.3). */}
          {full !== short && <Box component="span" sx={visuallyHidden}>{`, ${full}`}</Box>}
        </ButtonBase>
      );
    })}
  </Box>
);

export default RoundTabs;
