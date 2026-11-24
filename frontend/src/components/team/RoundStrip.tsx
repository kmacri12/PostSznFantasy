import { Box, ButtonBase, ClickAwayListener, Popper, Typography } from "@mui/material";
import { useRef } from "react";
import type { RoundLineup } from "../../api/types";
import { tokens } from "../../theme";
import { visuallyHidden } from "../common/visuallyHidden";
import { formatPoints, ROUNDS } from "../league/standingsView";
import { ROUND_LABELS } from "./lineup";
import { roundScore } from "./lineupView";

export interface LineupNudge {
  /** The round whose tab gets the dashed outline. */
  round: number;
  /** The reminder bubble: shown on the first visit, closed by a tap anywhere. */
  tipOpen: boolean;
  onTipClose: () => void;
}

interface Props {
  lineups: RoundLineup[];
  round: number;
  onSelect: (round: number) => void;
  nudge?: LineupNudge | null;
}

/** Four cells, one per playoff round, each with that round's team score; the chosen one is outlined. */
const RoundStrip = ({ lineups, round, onSelect, nudge }: Props) => {
  const nudgedTab = useRef<HTMLButtonElement>(null);
  return (
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
        const nudged = nudge?.round === lineup.round;
        return (
          <ButtonBase
            key={lineup.round}
            ref={nudged ? nudgedTab : undefined}
            role="tab"
            aria-selected={selected}
            onClick={() => onSelect(lineup.round)}
            sx={{
              display: "block",
              minHeight: 48,
              py: selected || nudged ? "3px" : "4px",
              textAlign: "center",
              borderRadius: "10px",
              border: selected
                ? `2px solid ${tokens.accent}`
                : nudged
                  ? `2px dashed ${tokens.accent}`
                  : `1px solid ${tokens.borderStrong}`,
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
      {nudge?.tipOpen && (
        <ClickAwayListener onClickAway={nudge.onTipClose}>
          <Popper
            open
            anchorEl={nudgedTab.current}
            placement="bottom"
            sx={{ zIndex: 1500 }}
            modifiers={[{ name: "offset", options: { offset: [0, 8] } }]}
          >
            <Box
              role="note"
              sx={{
                maxWidth: "min(260px, calc(100vw - 32px))",
                p: 1.5,
                bgcolor: tokens.surfaceRaised,
                color: tokens.text,
                border: `1px solid ${tokens.accent}`,
                borderRadius: 2,
                boxShadow: 4,
              }}
            >
              <Typography sx={{ fontSize: 14, fontWeight: 600 }}>
                Don't forget to set your lineup!
              </Typography>
            </Box>
          </Popper>
        </ClickAwayListener>
      )}
    </Box>
  );
};

export default RoundStrip;
