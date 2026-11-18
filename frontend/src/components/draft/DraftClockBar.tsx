import { Box, GlobalStyles, Typography } from "@mui/material";
import type { DraftState } from "../../api/types";
import { AUTOPILOT, HELP_TIPS } from "../../content/rules";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { HEADER_HEIGHT, tokens } from "../../theme";
import HelpTip from "../common/HelpTip";
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
  const onAutopilot =
    state.status === "in_progress" &&
    state.onTheClockTeamId !== null &&
    state.autopilotTeamIds.includes(state.onTheClockTeamId);
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
        // My turn fills the whole bar with the accent so it reads from across the room.
        bgcolor: text.myTurn ? tokens.accentFill : tokens.surface,
        color: text.myTurn ? tokens.accentInk : undefined,
        borderBottom: `1px solid ${text.myTurn ? tokens.accentInk : tokens.border}`,
        animation:
          text.myTurn && !reducedMotion ? "ps-turn-pulse 1.6s ease-out infinite" : undefined,
      }}
    >
      {text.myTurn && !reducedMotion && (
        <GlobalStyles
          styles={{
            "@keyframes ps-turn-pulse": {
              from: { boxShadow: `inset 0 0 0 4px ${tokens.accentInk}` },
              to: { boxShadow: "inset 0 0 0 4px transparent" },
            },
          }}
        />
      )}
      <Box sx={{ minWidth: 0 }}>
        <Typography
          sx={{
            fontSize: text.myTurn ? 20 : 16,
            fontWeight: text.myTurn ? 800 : 700,
            lineHeight: 1.2,
            color: text.myTurn ? tokens.accentInk : tokens.text,
          }}
        >
          {text.title}
          {onAutopilot && (
            <Box
              component="span"
              sx={{
                ml: 0.75,
                fontSize: 12,
                color: text.myTurn ? tokens.accentInk : tokens.warning,
              }}
            >
              · {AUTOPILOT.marker}
            </Box>
          )}
        </Typography>
        {text.subtitle && (
          <Typography sx={{ fontSize: 12, color: text.myTurn ? tokens.accentInk : tokens.muted }}>
            {text.subtitle}
          </Typography>
        )}
        {text.picksAway && (
          <Typography
            component="span"
            sx={{
              display: "inline-block",
              mt: 0.5,
              px: 1,
              borderRadius: 1,
              fontSize: 12,
              fontWeight: 700,
              color: tokens.accentInk,
              bgcolor: tokens.accentFill,
            }}
          >
            {text.picksAway}
          </Typography>
        )}
      </Box>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          flexShrink: 0,
          "& .MuiIconButton-root": { color: text.myTurn ? tokens.accentInk : undefined },
        }}
      >
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
                color: text.myTurn ? tokens.accentInk : tokens.text,
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
        <HelpTip {...HELP_TIPS.draft} />
        <CogButton label="Draft settings" onClick={onOpenSettings} />
      </Box>
      <DraftAnnouncer state={state} myTeamId={myTeamId} secondsLeft={secondsLeft} />
    </Box>
  );
};

export default DraftClockBar;
