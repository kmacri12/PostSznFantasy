import { Box, Chip, Paper, Typography } from "@mui/material";
import type { DraftSnapshot } from "../../api/types";
import PickClock, { formatClock } from "./PickClock";

interface Props {
  state: DraftSnapshot;
  secondsLeft: number | null;
  secondsToStart: number | null;
  isConnected: boolean;
  myTeamId: number | null;
}

const STATUS_TEXT = {
  unscheduled: "Draft not scheduled",
  scheduled: "Waiting for the draft to start",
  lobby: "Lobby open",
  in_progress: "Draft in progress",
  paused: "Draft paused",
  completed: "Draft complete",
} as const;

/** Clock, status and on-the-clock/on-deck banners; everything derives from server state. */
const DraftStatusBar = ({ state, secondsLeft, secondsToStart, isConnected, myTeamId }: Props) => {
  const teamName = (id: number | null) => state.order.find((slot) => slot.teamId === id)?.teamName;
  const myTurn = myTeamId !== null && state.onTheClockTeamId === myTeamId;
  const onDeck = myTeamId !== null && state.onDeckTeamId === myTeamId;
  const urgent = secondsLeft !== null && secondsLeft <= 10 && state.status === "in_progress";

  return (
    <Paper sx={{ p: 2, display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
      <Box sx={{ flexGrow: 1 }}>
        <Typography variant="h5">{STATUS_TEXT[state.status]}</Typography>
        {state.status === "in_progress" || state.status === "paused" ? (
          <Typography color="text.secondary">
            {state.currentPickOverall
              ? `Pick ${state.currentPickOverall} of ${state.totalPicks}: ${teamName(state.onTheClockTeamId) ?? "…"} on the clock`
              : "Finishing up"}
          </Typography>
        ) : (
          state.startTime &&
          state.status !== "completed" && (
            <Typography color="text.secondary">
              Scheduled for {new Date(state.startTime).toLocaleString()}
            </Typography>
          )
        )}
      </Box>
      {myTurn && <Chip color="primary" label="You're on the clock" />}
      {!myTurn && onDeck && <Chip color="secondary" label="You're on deck" />}
      <PickClock secondsLeft={secondsLeft} isConnected={isConnected} urgent={urgent} />
      {secondsToStart !== null && (
        <Typography
          variant="h4"
          aria-label="Time until start"
          sx={{ fontVariantNumeric: "tabular-nums" }}
        >
          Starts in {formatClock(secondsToStart)}
        </Typography>
      )}
    </Paper>
  );
};

export default DraftStatusBar;
