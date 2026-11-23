import { Box, ButtonBase, ClickAwayListener, Popper } from "@mui/material";
import { type KeyboardEvent, type ReactNode, useId, useRef, useState } from "react";
import { tokens } from "../../theme";
import type { PlayerStatus } from "./lineupView";
import {
  playersLeftText,
  rosterLeft,
  STATUS_COLOR,
  STATUS_LABEL,
  statusSummary,
} from "./statusStyle";

/** The order the owner asked for: the bad news first. */
const BREAKDOWN_ORDER: PlayerStatus[] = ["eliminated", "live", "toPlay", "advanced"];

/** One line per status with its count, zeros included: "2 eliminated", "3 live". */
export const StatusBreakdownList = ({
  counts,
  id,
}: {
  counts: Record<PlayerStatus, number>;
  id?: string;
}) => (
  <Box
    id={id}
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
    {BREAKDOWN_ORDER.map((status) => (
      <Box key={status} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Box
          aria-hidden
          component="span"
          sx={{ width: 9, height: 9, borderRadius: "50%", bgcolor: STATUS_COLOR[status] }}
        />
        <b>{counts[status]}</b> {STATUS_LABEL[status]}
      </Box>
    ))}
  </Box>
);

/**
 * Makes a team picture (with its ring) a button: a tap opens the breakdown of the team's players
 * by status. The button is a sibling of a row's own link or expand control, never inside one.
 */
const StatusBreakdownTrigger = ({
  counts,
  children,
}: {
  counts: Record<PlayerStatus, number> | null | undefined;
  children: ReactNode;
}) => {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  const legendId = useId();
  if (!counts) return <>{children}</>;
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || !open) return;
    event.stopPropagation();
    setOpen(false);
    anchor.current?.focus();
  };
  return (
    <ClickAwayListener onClickAway={() => setOpen(false)}>
      <Box component="span" sx={{ display: "inline-flex", flex: "none" }} onKeyDown={onKeyDown}>
        <ButtonBase
          ref={anchor}
          aria-label={`${playersLeftText(rosterLeft(counts))}: ${statusSummary(counts)}`}
          aria-expanded={open}
          aria-describedby={open ? legendId : undefined}
          onClick={() => setOpen((value) => !value)}
          sx={{ minWidth: 44, minHeight: 44, borderRadius: "50%" }}
        >
          {children}
        </ButtonBase>
        <Popper
          open={open}
          anchorEl={anchor.current}
          placement="bottom-start"
          sx={{ zIndex: 1500 }}
        >
          <StatusBreakdownList counts={counts} id={legendId} />
        </Popper>
      </Box>
    </ClickAwayListener>
  );
};

export default StatusBreakdownTrigger;
