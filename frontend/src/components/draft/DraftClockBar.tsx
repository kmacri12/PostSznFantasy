import { Box, GlobalStyles, Typography } from "@mui/material";
import type { DraftState } from "../../api/types";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { HEADER_HEIGHT, tokens } from "../../theme";
import CogButton from "../settings/CogButton";
import { clockText } from "./clockText";
import DraftAnnouncer from "./DraftAnnouncer";

interface Props {
  state: DraftState;
  myTeamId: number | null;
  secondsLeft: number | null;
  secondsToStart: number | null;
  isConnected: boolean;
  onOpenSettings: () => void;
}

/**
 * Sticky bar: round and pick, the team on the clock and the countdown (green on my turn). The bar
 * is not a live region, as the clock changes every second; `DraftAnnouncer` speaks the changes.
 */
const DraftClockBar = ({
  state,
  myTeamId,
  secondsLeft,
  secondsToStart,
  isConnected,
  onOpenSettings,
}: Props) => {
  const text = clockText(state, myTeamId, secondsLeft, secondsToStart);
  const reducedMotion = useReducedMotion();
  const urgent = text.myTurn && secondsLeft !== null && secondsLeft <= 10;
  return (
    <Box
      component="section"
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
        // One soft pulse when the turn arrives, so a glance at the phone catches it.
        animation: text.myTurn && !reducedMotion ? "ps-turn-pulse 1.4s ease-out 1" : undefined,
      }}
    >
      {text.myTurn && !reducedMotion && (
        <GlobalStyles
          styles={{
            "@keyframes ps-turn-pulse": {
              from: { boxShadow: `inset 0 0 0 3px ${tokens.accent}` },
              to: { boxShadow: "inset 0 0 0 3px transparent" },
            },
          }}
        />
      )}
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
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }}>
        <Box sx={{ textAlign: "right" }}>
          {text.timer !== null && (
            <Typography
              role="timer"
              aria-label={`Pick clock ${text.timer}`}
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
        <CogButton label="Draft settings" onClick={onOpenSettings} />
      </Box>
      <DraftAnnouncer state={state} myTeamId={myTeamId} secondsLeft={secondsLeft} />
    </Box>
  );
};

export default DraftClockBar;
