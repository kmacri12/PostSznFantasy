import { Box, Paper, Typography } from "@mui/material";
import type React from "react";
import type { DraftPick, DraftState } from "../../api/types";
import { tokens } from "../../theme";
import { positionColor } from "./positions";

interface Props {
  state: DraftState;
  myTeamId: number | null;
}

/** Teams as columns in assigned order, rounds as rows; snake direction is shown per row. */
const DraftBoard: React.FC<Props> = ({ state, myTeamId }) => {
  const columns = `48px repeat(${state.order.length || 1}, minmax(112px, 1fr))`;
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
    <Paper sx={{ p: 1.5, overflowX: "auto" }}>
      <Box
        sx={{ display: "grid", gridTemplateColumns: columns, gap: 0.75, minWidth: "max-content" }}
      >
        <Box />
        {state.order.map((slot) => (
          <Box key={slot.teamId} sx={{ px: 1, py: 0.5 }}>
            <Typography
              variant="subtitle2"
              noWrap
              sx={{ color: slot.teamId === myTeamId ? tokens.gold : "inherit" }}
            >
              {slot.teamName}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {slot.ownerName ?? "Unclaimed"}
            </Typography>
          </Box>
        ))}
        {Array.from({ length: state.rounds }, (_, round) => (
          <Box key={`round-${round + 1}`} sx={{ display: "contents" }}>
            <Box sx={{ display: "flex", alignItems: "center", color: tokens.muted }}>
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
                    p: 0.75,
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
