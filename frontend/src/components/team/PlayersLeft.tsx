import { Box, ButtonBase, ClickAwayListener, Popper } from "@mui/material";
import { type KeyboardEvent, useId, useRef, useState } from "react";
import { tokens } from "../../theme";
import { PLAYER_STATUSES, type RosterStatus } from "./lineupView";
import { playersLeftText, STATUS_COLOR, STATUS_LABEL, statusSummary } from "./statusStyle";

/**
 * "10 players left" as a text button; a tap opens what the dots around the team picture mean, with
 * the counts. The button is 44px tall to tap but takes only its line's height in the page.
 */
const PlayersLeft = ({ status }: { status: RosterStatus }) => {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  const legendId = useId();
  const present = PLAYER_STATUSES.filter((entry) => status.counts[entry] > 0);
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
                    width: 9,
                    height: 9,
                    borderRadius: "50%",
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
