import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { Box, ClickAwayListener, IconButton, Popper, Typography } from "@mui/material";
import { type KeyboardEvent, type PointerEvent, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useOptionalSeasonContext } from "../../contexts/SeasonContext";
import { tokens } from "../../theme";

interface Props {
  /** What the control is about, for screen readers: "About Team QB". */
  label: string;
  text: string;
  /** A How to play rule id; adds a "Read more" link to that section. */
  ruleId?: string;
}

const HOVER_CLOSE_MS = 150;

/**
 * A small "?" whose explanation opens in place: a tap or Enter/Space toggles it, a mouse hover
 * shows it, Escape and a tap outside close it. The popover has no motion, so it is already
 * reduced-motion safe.
 */
const HelpTip = ({ label, text, ruleId }: Props) => {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  const popoverId = useId();
  const season = useOptionalSeasonContext();
  const howToPlay = season ? season.paths.howToPlay : "/how-to-play";

  const cancelClose = () => window.clearTimeout(closeTimer.current);
  const hoverOpen = (event: PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    cancelClose();
    setOpen(true);
  };
  const hoverClose = (event: PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpen(false), HOVER_CLOSE_MS);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || !open) return;
    event.stopPropagation();
    setOpen(false);
    anchor.current?.focus();
  };

  return (
    <ClickAwayListener onClickAway={() => setOpen(false)}>
      <Box component="span" sx={{ display: "inline-flex" }} onKeyDown={onKeyDown}>
        <IconButton
          ref={anchor}
          aria-label={`About ${label}`}
          aria-expanded={open}
          aria-describedby={open ? popoverId : undefined}
          onClick={() => {
            cancelClose();
            setOpen((value) => !value);
          }}
          onPointerEnter={hoverOpen}
          onPointerLeave={hoverClose}
          sx={{ width: 44, height: 44, color: tokens.muted }}
        >
          <InfoOutlinedIcon fontSize="small" />
        </IconButton>
        <Popper open={open} anchorEl={anchor.current} placement="bottom" sx={{ zIndex: 1500 }}>
          <Box
            id={popoverId}
            role="note"
            onPointerEnter={hoverOpen}
            onPointerLeave={hoverClose}
            sx={{
              maxWidth: "min(320px, calc(100vw - 32px))",
              p: 1.5,
              bgcolor: tokens.surfaceRaised,
              color: tokens.text,
              border: `1px solid ${tokens.borderStrong}`,
              borderRadius: 2,
              boxShadow: 4,
            }}
          >
            <Typography sx={{ fontSize: 14 }}>{text}</Typography>
            {ruleId && (
              <Box
                component={Link}
                to={`${howToPlay}#rule-${ruleId}`}
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  minHeight: 44,
                  fontSize: 14,
                  fontWeight: 600,
                  color: tokens.accent,
                }}
              >
                Read more
              </Box>
            )}
          </Box>
        </Popper>
      </Box>
    </ClickAwayListener>
  );
};

export default HelpTip;
