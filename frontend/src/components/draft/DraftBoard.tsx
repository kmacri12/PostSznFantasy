import { Box, Button, Paper, Typography } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import type { DraftPick, DraftState, ReservedPick } from "../../api/types";
import { prefersReducedMotion } from "../../hooks/useReducedMotion";
import { tokens } from "../../theme";
import TeamUnitBadge from "../common/TeamUnitBadge";
import { visuallyHidden } from "../common/visuallyHidden";
import SettingsSheet from "../settings/SettingsSheet";
import { centeredScroll } from "./boardScroll";
import { positionColor } from "./positions";

interface Props {
  state: DraftState;
  myTeamId: number | null;
  /** Frame size overrides: the page decides how tall the board may be. */
  sx?: SxProps<Theme>;
  /** Commissioners get an "Assign pick" button in the tapped cell's sheet. */
  onSelectSlot?: (slot: { pickNumber: number; teamName: string }) => void;
}

export interface BoardCell {
  overall: number;
  round: number;
  teamId: number;
  teamName: string;
  pick: DraftPick | undefined;
  reserved: ReservedPick | undefined;
  onClock: boolean;
}

const ROUND_COL = 28;
// 6 teams (the default league) fit a 375px phone; bigger leagues scroll with pinned headers.
const TEAM_COL = 56;
const HEADER_ROW = 40;
const CELL_HEIGHT = 56;

/** Initials for the narrow column header; the full name opens with the cell. */
export const teamInitials = (name: string): string => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return name.trim().slice(0, 3);
  return words
    .slice(0, 3)
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase();
};

/** "Christian McCaffrey" reads "McCaffrey"; team defenses keep their name. */
export const lastName = (name: string | null, position: string | null): string => {
  if (!name) return "";
  const [first, ...rest] = name.split(" ");
  if (position === "DST" || !first || rest.length === 0) return name;
  return rest.join(" ");
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
const DraftBoard: React.FC<Props> = ({ state, myTeamId, sx, onSelectSlot }) => {
  const [selected, setSelected] = useState<BoardCell | null>(null);
  const teamCount = state.order.length;
  const columns = `${ROUND_COL}px repeat(${teamCount || 1}, minmax(${TEAM_COL}px, 1fr))`;
  const frameRef = useRef<HTMLDivElement>(null);
  const reservedByOverall = new Map(state.reservedPicks.map((item) => [item.pickNumber, item]));
  const byOverall = new Map<number, DraftPick>(state.picks.map((p) => [p.numberPickOverall, p]));

  // Overall pick number for a team's cell in a round, honouring the draft type's direction.
  const isReversed = (round: number): boolean =>
    state.draftType === "snake"
      ? round % 2 === 1
      : state.draftType === "third_round_reversal"
        ? round === 1 || (round >= 2 && round % 2 === 0)
        : false;
  const overallFor = (round: number, slotIndex: number): number => {
    const reversed = isReversed(round);
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
      behavior: prefersReducedMotion() ? "auto" : "smooth",
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
              px: 0.5,
              display: "flex",
              alignItems: "center",
              minWidth: 0,
            }}
          >
            <Typography
              noWrap
              title={slot.teamName}
              sx={{
                fontSize: 12,
                fontWeight: 700,
                width: "100%",
                textAlign: "center",
                color: slot.teamId === myTeamId ? tokens.accent : tokens.text,
              }}
            >
              {teamInitials(slot.teamName)}
              <Box component="span" sx={visuallyHidden}>{` ${slot.teamName}`}</Box>
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
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                color: tokens.muted,
                fontSize: 12,
                fontWeight: 600,
                lineHeight: 1.2,
              }}
            >
              {round + 1}
              <Box component="span" aria-hidden sx={{ fontSize: 11 }}>
                {isReversed(round) ? "←" : "→"}
              </Box>
              <Box component="span" sx={visuallyHidden}>
                {isReversed(round) ? "right to left" : "left to right"}
              </Box>
            </Box>
            {state.order.map((slot, slotIndex) => {
              const overall = overallFor(round, slotIndex);
              const pick = byOverall.get(overall);
              const onClock = overall === onClockOverall && state.status !== "completed";
              const mine = slot.teamId === myTeamId;
              const cell: BoardCell = {
                overall,
                round: round + 1,
                teamId: slot.teamId,
                teamName: slot.teamName,
                pick,
                reserved: reservedByOverall.get(overall),
                onClock,
              };
              return (
                <Box
                  key={`${round}-${slot.teamId}`}
                  component="button"
                  type="button"
                  data-testid={`pick-${overall}`}
                  aria-label={cellLabel(cell)}
                  onClick={() => setSelected(cell)}
                  sx={{
                    ...gridLine,
                    appearance: "none",
                    font: "inherit",
                    textAlign: "left",
                    cursor: "pointer",
                    height: CELL_HEIGHT,
                    minWidth: 0,
                    minHeight: 44,
                    px: 0.5,
                    py: 0.5,
                    fontSize: 10,
                    lineHeight: 1.25,
                    overflow: "hidden",
                    border: 0,
                    borderRight: `1px solid ${tokens.border}`,
                    borderBottom: `1px solid ${tokens.border}`,
                    color: onClock ? tokens.accentInk : tokens.textSoft,
                    fontWeight: onClock ? 700 : 400,
                    bgcolor: onClock
                      ? tokens.accentFill
                      : pick
                        ? positionColor(pick.position)
                        : tokens.bg,
                    boxShadow: mine ? `inset 0 0 0 2px ${tokens.accent}` : undefined,
                  }}
                >
                  <Box
                    component="span"
                    sx={{
                      display: "block",
                      fontSize: 9,
                      color: onClock ? "inherit" : tokens.muted,
                    }}
                  >
                    {overall}
                    {onClock ? " · NOW" : ""}
                  </Box>
                  {cell.reserved && !pick && (
                    <>
                      <Typography
                        noWrap
                        component="b"
                        sx={{ display: "block", fontSize: 11, fontWeight: 600, color: tokens.text }}
                      >
                        {lastName(cell.reserved.playerName, cell.reserved.position)}
                      </Typography>
                      <Box component="span" sx={{ display: "block" }} aria-hidden>
                        Reserved
                      </Box>
                    </>
                  )}
                  {pick && (
                    <>
                      <Typography
                        noWrap
                        component="b"
                        sx={{ display: "block", fontSize: 11, fontWeight: 600, color: tokens.text }}
                      >
                        {lastName(pick.playerName, pick.position)}
                      </Typography>
                      <Box component="span" sx={{ display: "block" }} aria-hidden>
                        {pick.position} {pick.teamAbv}
                      </Box>
                    </>
                  )}
                </Box>
              );
            })}
          </Box>
        ))}
      </Box>
      {selected && (
        <SettingsSheet title={`Pick ${selected.overall}`} onClose={() => setSelected(null)}>
          <CellDetails cell={selected} />
          {onSelectSlot && (
            <Button
              variant="outlined"
              sx={{ minHeight: 44 }}
              onClick={() => {
                onSelectSlot({ pickNumber: selected.overall, teamName: selected.teamName });
                setSelected(null);
              }}
            >
              {`Assign pick ${selected.overall}`}
            </Button>
          )}
        </SettingsSheet>
      )}
    </Paper>
  );
};

const cellLabel = ({ overall, pick, teamName, onClock }: BoardCell): string =>
  pick
    ? `Pick ${overall}, ${teamName}: ${pick.playerName ?? "player"}`
    : `Pick ${overall}, ${teamName}${onClock ? ", on the clock" : ""}`;

const CellDetails = ({ cell }: { cell: BoardCell }) => {
  const { pick, reserved, teamName, round, onClock } = cell;
  const lines = [`Round ${round}`, teamName];
  if (!pick && reserved) {
    return (
      <Box>
        <Typography sx={{ fontWeight: 700 }}>{reserved.playerName}</Typography>
        <Typography color="text.secondary">
          {[reserved.position, reserved.teamAbv].filter(Boolean).join(" · ")}
        </Typography>
        <Typography color="text.secondary">
          {lines.join(" · ")} · Reserved by the commissioner
        </Typography>
      </Box>
    );
  }
  if (!pick) {
    return (
      <Box>
        <Typography color="text.secondary">{lines.join(" · ")}</Typography>
        <Typography>
          {onClock ? `${teamName} is on the clock.` : `${teamName} picks here.`}
        </Typography>
      </Box>
    );
  }
  return (
    <Box>
      <Typography sx={{ fontWeight: 700 }}>{pick.playerName}</Typography>
      <Typography color="text.secondary">
        {[pick.position, pick.teamAbv].filter(Boolean).join(" · ")}
      </Typography>
      <Typography color="text.secondary">
        {lines.join(" · ")}
        {pick.autopick ? " · Auto-pick" : ""}
      </Typography>
      {pick.scoresWholeTeam && (
        <Box sx={{ mt: 0.5 }}>
          <TeamUnitBadge position={pick.position ?? ""} teamAbv={pick.teamAbv} dense />
        </Box>
      )}
    </Box>
  );
};

export default DraftBoard;
