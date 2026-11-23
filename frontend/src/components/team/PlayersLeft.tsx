import { Box, ButtonBase, ClickAwayListener, Popper, Typography } from "@mui/material";
import { type KeyboardEvent, useId, useRef, useState } from "react";
import { tokens } from "../../theme";
import { PLAYER_STATUSES, type RosterStatus } from "./lineupView";
import StatusPips, { STATUS_COLOR, STATUS_LABEL } from "./StatusPips";

const PIP = 9;
const GAP = 3;
/** Side padding of the button, so the squares do not touch its edge. */
const PAD = 4;

/** Two near-equal rows of squares: 15 players are 8 + 7. */
export const gridColumns = (players: number): number =>
  Math.min(10, Math.max(4, Math.ceil(players / 2)));

/** Width of the grid layout's button, so the header can tell whether it fits beside the name. */
export const gridWidth = (players: number): number =>
  gridColumns(players) * (PIP + GAP) - GAP + 2 * PAD;

/**
 * Players left as one small square per rostered player (green advanced, blue live, grey to play,
 * red eliminated) under "13 left". A tap opens what the colours mean, with the counts. `grid` is
 * two rows for the gap beside the team name; `row` is one line, for when the name needs the room.
 */
const PlayersLeft = ({ status, layout }: { status: RosterStatus; layout: "grid" | "row" }) => {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  const legendId = useId();
  const players = status.statuses.length;
  const present = PLAYER_STATUSES.filter((entry) => status.counts[entry] > 0);
  const summary = present
    .map((entry) => `${status.counts[entry]} ${STATUS_LABEL[entry]}`)
    .join(", ");
  const columns = layout === "grid" ? gridColumns(players) : Math.min(players, 16);
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || !open) return;
    event.stopPropagation();
    setOpen(false);
    anchor.current?.focus();
  };

  return (
    <ClickAwayListener onClickAway={() => setOpen(false)}>
      <Box
        component="span"
        // The row layout keeps its 44px tap target but only takes the line's own height in the page.
        sx={{ display: "inline-flex", flexShrink: 0, my: layout === "row" ? "-10px" : 0 }}
        onKeyDown={onKeyDown}
      >
        <ButtonBase
          ref={anchor}
          aria-label={`${status.left} left, ${summary}`}
          aria-expanded={open}
          aria-describedby={open ? legendId : undefined}
          onClick={() => setOpen((value) => !value)}
          sx={{
            minHeight: 44,
            px: `${PAD}px`,
            borderRadius: 1,
            display: "flex",
            flexDirection: layout === "grid" ? "column" : "row",
            alignItems: layout === "grid" ? "flex-start" : "center",
            justifyContent: "center",
            gap: layout === "grid" ? "3px" : 1,
          }}
        >
          <Typography
            component="span"
            sx={{ fontSize: 12, color: tokens.textSoft, whiteSpace: "nowrap", lineHeight: 1.2 }}
          >
            <b style={{ color: tokens.text, fontSize: 14 }}>{status.left}</b> left
          </Typography>
          <StatusPips counts={status.counts} size={PIP} gap={GAP} columns={columns} />
        </ButtonBase>
        <Popper open={open} anchorEl={anchor.current} placement="bottom" sx={{ zIndex: 1500 }}>
          <Box
            id={legendId}
            role="note"
            sx={{
              p: 1.5,
              display: "grid",
              gap: 0.75,
              bgcolor: tokens.surfaceRaised,
              color: tokens.text,
              border: `1px solid ${tokens.borderStrong}`,
              borderRadius: 2,
              boxShadow: 4,
              fontSize: 13,
            }}
          >
            {present.map((entry) => (
              <Box key={entry} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Box
                  aria-hidden
                  component="span"
                  sx={{
                    width: PIP,
                    height: PIP,
                    borderRadius: "3px",
                    bgcolor: STATUS_COLOR[entry],
                  }}
                />
                <b>{status.counts[entry]}</b> {STATUS_LABEL[entry]}
              </Box>
            ))}
          </Box>
        </Popper>
      </Box>
    </ClickAwayListener>
  );
};

export default PlayersLeft;
