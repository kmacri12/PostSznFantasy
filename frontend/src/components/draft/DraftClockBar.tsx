import { Box, Typography } from "@mui/material";
import type { DraftState } from "../../api/types";
import { HEADER_HEIGHT, tokens } from "../../theme";
import { clockText } from "./clockText";

interface Props {
  state: DraftState;
  myTeamId: number | null;
  secondsLeft: number | null;
  secondsToStart: number | null;
  isConnected: boolean;
}

/** Sticky bar: round and pick, the team on the clock and the countdown (green on my turn). */
const DraftClockBar = ({ state, myTeamId, secondsLeft, secondsToStart, isConnected }: Props) => {
  const text = clockText(state, myTeamId, secondsLeft, secondsToStart);
  const urgent = text.myTurn && secondsLeft !== null && secondsLeft <= 10;
  return (
    <Box
      role="status"
      aria-label="Draft clock"
      sx={{
        position: "sticky",
        top: HEADER_HEIGHT,
        zIndex: 5,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 2,
        px: 2,
        py: 1.25,
        bgcolor: text.myTurn ? tokens.accentSurface : tokens.surface,
        borderBottom: `1px solid ${text.myTurn ? tokens.accentBorder : tokens.border}`,
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography
          sx={{ fontSize: 16, fontWeight: 700, color: text.myTurn ? tokens.accent : tokens.text }}
        >
          {text.title}
        </Typography>
        {text.subtitle && (
          <Typography sx={{ fontSize: 12, color: text.myTurn ? tokens.accentSoft : tokens.muted }}>
            {text.subtitle}
          </Typography>
        )}
      </Box>
      <Box sx={{ textAlign: "right", flexShrink: 0 }}>
        {text.timer !== null && (
          <Typography
            aria-label="Pick clock"
            sx={{
              fontSize: 28,
              fontWeight: 700,
              lineHeight: 1.1,
              fontVariantNumeric: "tabular-nums",
              color: urgent && isConnected ? tokens.red : tokens.text,
              opacity: isConnected ? 1 : 0.4,
            }}
          >
            {text.timer}
          </Typography>
        )}
        {!isConnected && (
          <Typography sx={{ fontSize: 11, color: tokens.warning }}>Reconnecting…</Typography>
        )}
      </Box>
    </Box>
  );
};

export default DraftClockBar;
