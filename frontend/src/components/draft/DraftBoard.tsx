import { Box, Paper, Typography } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import type React from "react";
import { useEffect, useRef } from "react";
import type { DraftPick, DraftState } from "../../api/types";
import { tokens } from "../../theme";
import TeamUnitBadge from "../common/TeamUnitBadge";
import { centeredScroll } from "./boardScroll";
import { positionColor } from "./positions";

interface Props {
  state: DraftState;
  myTeamId: number | null;
  /** Frame size overrides: the page decides how tall the board may be. */
  sx?: SxProps<Theme>;
}

const ROUND_COL = 44;
const TEAM_COL = 104;
const HEADER_ROW = 44;
const CELL_HEIGHT = 64;

/** "Christian McCaffrey" reads "C. McCaffrey"; team defenses keep their name. */
export const shortName = (name: string | null, position: string | null): string => {
  if (!name) return "";
  const [first, ...rest] = name.split(" ");
  if (position === "DST" || !first || rest.length === 0) return name;
  return `${first.charAt(0)}. ${rest.join(" ")}`;
};

const pinned = { position: "sticky", bgcolor: tokens.surface } as const;
const gridLine = {
  borderRight: `1px solid ${tokens.border}`,
  borderBottom: `1px solid ${tokens.border}`,
} as const;

/**
 * Teams as columns in assigned order, rounds as rows; snake direction is shown per row.
 * The grid scrolls both ways inside its own frame with the round and team headers pinned,
 * and follows the pick on the clock.
 */
const DraftBoard: React.FC<Props> = ({ state, myTeamId, sx }) => {
  const teamCount = state.order.length;
  const columns = `${ROUND_COL}px repeat(${teamCount || 1}, minmax(${TEAM_COL}px, 1fr))`;
  const frameRef = useRef<HTMLDivElement>(null);
  const byOverall = new Map<number, DraftPick>(state.picks.map((p) => [p.numberPickOverall, p]));

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
        minHeight: 240,
        maxHeight: "calc(100dvh - 330px)",
        ...sx,
      }}
    >
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: columns,
          minWidth: ROUND_COL + teamCount * TEAM_COL,
        }}
      >
        <Box sx={{ ...pinned, ...gridLine, top: 0, left: 0, zIndex: 3, height: HEADER_ROW }} />
        {state.order.map((slot) => (
          <Box
            key={slot.teamId}
            sx={{
              ...pinned,
              ...gridLine,
              top: 0,
              zIndex: 2,
              height: HEADER_ROW,
              px: 1,
              display: "flex",
              alignItems: "center",
              minWidth: 0,
            }}
          >
            <Typography
              noWrap
              sx={{
                fontSize: 12,
                fontWeight: 600,
                color: slot.teamId === myTeamId ? tokens.accent : tokens.text,
              }}
            >
              {slot.teamName}
            </Typography>
          </Box>
        ))}
        {Array.from({ length: state.rounds }, (_, round) => (
          <Box key={`round-${round + 1}`} sx={{ display: "contents" }}>
            <Box
              sx={{
                ...pinned,
                ...gridLine,
                left: 0,
                zIndex: 1,
                height: CELL_HEIGHT,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: tokens.muted,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {round + 1}
            </Box>
            {state.order.map((slot, slotIndex) => {
              const overall = overallFor(round, slotIndex);
              const pick = byOverall.get(overall);
              const onClock = overall === onClockOverall && state.status !== "completed";
              const mine = slot.teamId === myTeamId;
              return (
                <Box
                  key={`${round}-${slot.teamId}`}
                  data-testid={`pick-${overall}`}
                  sx={{
                    ...gridLine,
                    height: CELL_HEIGHT,
                    minWidth: 0,
                    px: 0.875,
                    py: 0.75,
                    fontSize: 11,
                    lineHeight: 1.3,
                    color: onClock ? tokens.accentInk : tokens.textSoft,
                    fontWeight: onClock ? 700 : 400,
                    bgcolor: onClock
                      ? tokens.accent
                      : pick
                        ? positionColor(pick.position)
                        : tokens.bg,
                    boxShadow: mine ? `inset 0 0 0 2px ${tokens.accent}` : undefined,
                  }}
                >
                  {onClock && "On the clock"}
                  {pick && (
                    <>
                      <Typography
                        noWrap
                        component="b"
                        sx={{ display: "block", fontSize: 12, fontWeight: 600, color: tokens.text }}
                      >
                        {shortName(pick.playerName, pick.position)}
                      </Typography>
                      {pick.position} {pick.teamAbv}
                      {pick.autopick ? " · auto" : ""}
                      {pick.scoresWholeTeam && (
                        <Box component="span" sx={{ ml: 0.5 }}>
                          <TeamUnitBadge
                            position={pick.position ?? ""}
                            teamAbv={pick.teamAbv}
                            dense
                          />
                        </Box>
                      )}
                    </>
                  )}
                  <Box component="span" sx={visuallyHidden}>
                    {`Pick ${overall}`}
                  </Box>
                </Box>
              );
            })}
          </Box>
        ))}
      </Box>
    </Paper>
  );
};

const visuallyHidden = {
  position: "absolute",
  width: 1,
  height: 1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
} as const;

export default DraftBoard;
