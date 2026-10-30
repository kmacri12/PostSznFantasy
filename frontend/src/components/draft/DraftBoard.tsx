import { Box, Paper, Typography } from "@mui/material";
import type React from "react";
import { useEffect, useRef } from "react";
import type { DraftPick, DraftState } from "../../api/types";
import { tokens } from "../../theme";
import { centeredScroll } from "./boardScroll";
import { positionColor } from "./positions";

interface Props {
  state: DraftState;
  myTeamId: number | null;
}

const ROUND_COL = 52;
const TEAM_COL = 120;
const HEADER_ROW = 56;

const pinned = { position: "sticky", bgcolor: "background.paper" } as const;

/**
 * Teams as columns in assigned order, rounds as rows; snake direction is shown per row.
 * The grid scrolls both ways inside its own frame with the round and team headers pinned,
 * and follows the pick on the clock.
 */
const DraftBoard: React.FC<Props> = ({ state, myTeamId }) => {
  const columns = `${ROUND_COL}px repeat(${state.order.length || 1}, ${TEAM_COL}px)`;
  const frameRef = useRef<HTMLDivElement>(null);
  const byOverall = new Map<number, DraftPick>(state.picks.map((p) => [p.numberPickOverall, p]));
  const teamCount = state.order.length;

  // Overall pick number for a team's cell in a round, honouring the draft type's direction.
  const overallFor = (round: number, slotIndex: number): number => {
    const reversed =
      state.draftType === "snake"
        ? round % 2 === 1
        : state.draftType === "third_round_reversal"
          ? round === 1 || (round >= 2 && round % 2 === 0)
          : false;
    return round * teamCount + (reversed ? teamCount - 1 - slotIndex : slotIndex) + 1;
  };

  const onClockOverall = state.currentPickOverall;
  // biome-ignore lint/correctness/useExhaustiveDependencies: follow the clock, not every pick
  useEffect(() => {
    const frame = frameRef.current;
    const cell = frame?.querySelector<HTMLElement>(`[data-testid="pick-${onClockOverall}"]`);
    if (!frame || !cell || typeof frame.scrollTo !== "function") return;
    frame.scrollTo({
      left: centeredScroll(
        cell.offsetLeft,
        cell.offsetWidth,
        frame.clientWidth,
        ROUND_COL,
        frame.scrollWidth,
      ),
      top: centeredScroll(
        cell.offsetTop,
        cell.offsetHeight,
        frame.clientHeight,
        HEADER_ROW,
        frame.scrollHeight,
      ),
      behavior: "smooth",
    });
  }, [onClockOverall, teamCount]);

  if (teamCount === 0) {
    return (
      <Paper sx={{ p: 3, textAlign: "center" }}>
        <Typography color="text.secondary">
          The commissioner hasn't set the draft order yet.
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper
      ref={frameRef}
      aria-label="Draft board"
      tabIndex={0}
      sx={{
        position: "relative",
        overflow: "auto",
        overscrollBehavior: "contain",
        maxHeight: { xs: "calc(100dvh - 300px)", md: "calc(100dvh - 240px)" },
        minHeight: 240,
      }}
    >
      <Box sx={{ display: "grid", gridTemplateColumns: columns, width: "max-content" }}>
        <Box sx={{ ...pinned, top: 0, left: 0, zIndex: 3, height: HEADER_ROW }} />
        {state.order.map((slot) => (
          <Box
            key={slot.teamId}
            sx={{ ...pinned, top: 0, zIndex: 2, height: HEADER_ROW, px: 1, py: 0.5 }}
          >
            <Typography
              variant="subtitle2"
              noWrap
              sx={{ color: slot.teamId === myTeamId ? tokens.gold : "inherit" }}
            >
              {slot.teamName}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap component="div">
              {slot.ownerName ?? "Unclaimed"}
            </Typography>
          </Box>
        ))}
        {Array.from({ length: state.rounds }, (_, round) => (
          <Box key={`round-${round + 1}`} sx={{ display: "contents" }}>
            <Box
              sx={{
                ...pinned,
                left: 0,
                zIndex: 1,
                display: "flex",
                alignItems: "center",
                pl: 1,
                color: tokens.muted,
              }}
            >
              <Typography variant="caption">R{round + 1}</Typography>
            </Box>
            {state.order.map((slot, slotIndex) => {
              const overall = overallFor(round, slotIndex);
              const pick = byOverall.get(overall);
              const onClock = overall === state.currentPickOverall;
              return (
                <Box
                  key={`${round}-${slot.teamId}`}
                  data-testid={`pick-${overall}`}
                  sx={{
                    minHeight: 54,
                    m: 0.375,
                    p: 0.75,
                    minWidth: 0,
                    borderRadius: 1,
                    bgcolor: pick ? positionColor(pick.position) : "rgba(255,255,255,.03)",
                    border: onClock
                      ? `2px solid ${tokens.gold}`
                      : "1px solid rgba(255,255,255,.08)",
                  }}
                >
                  {pick ? (
                    <>
                      <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
                        {pick.playerName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {pick.position} · #{overall}
                        {pick.autopick ? " · auto" : ""}
                      </Typography>
                    </>
                  ) : (
                    <Typography variant="caption" color="text.secondary">
                      #{overall}
                    </Typography>
                  )}
                </Box>
              );
            })}
          </Box>
        ))}
      </Box>
    </Paper>
  );
};

export default DraftBoard;
