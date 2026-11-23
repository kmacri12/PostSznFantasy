import { Box, ButtonBase, ClickAwayListener, Popper } from "@mui/material";
import { type KeyboardEvent, useId, useRef, useState } from "react";
import { tokens } from "../../theme";
import type { RosterStatus } from "./lineupView";
import { StatusBreakdownList } from "./StatusBreakdown";
import { playersLeftText, statusSummary } from "./statusStyle";

/**
 * "10 players left" as a text button; a tap opens what the dots around the team picture mean, with
 * the counts. The button is 44px tall to tap but takes only its line's height in the page.
 */
const PlayersLeft = ({ status }: { status: RosterStatus }) => {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  const legendId = useId();
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || !open) return;
    event.stopPropagation();
    setOpen(false);
    anchor.current?.focus();
  };

  return (
    <ClickAwayListener onClickAway={() => setOpen(false)}>
      <Box component="span" sx={{ display: "inline-flex" }} onKeyDown={onKeyDown}>
        <ButtonBase
          ref={anchor}
          aria-label={`${playersLeftText(status.left)}, ${statusSummary(status.counts)}`}
          aria-expanded={open}
          aria-describedby={open ? legendId : undefined}
          onClick={() => setOpen((value) => !value)}
          sx={{
            minHeight: 44,
            my: "-14px",
            px: 0.5,
            borderRadius: 1,
            fontSize: "inherit",
            color: tokens.textSoft,
            whiteSpace: "nowrap",
            textDecoration: "underline dotted",
            textUnderlineOffset: "3px",
          }}
        >
          <b style={{ color: tokens.text }}>{status.left}</b>
          &nbsp;{status.left === 1 ? "player" : "players"} left
        </ButtonBase>
        <Popper open={open} anchorEl={anchor.current} placement="bottom" sx={{ zIndex: 1500 }}>
          <StatusBreakdownList counts={status.counts} id={legendId} />
        </Popper>
      </Box>
    </ClickAwayListener>
  );
};

export default PlayersLeft;
