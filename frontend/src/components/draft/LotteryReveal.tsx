import {
  Box,
  Button,
  DialogActions,
  DialogContent,
  DialogTitle,
  keyframes,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import type { DraftSlot } from "../../api/types";
import { LOTTERY } from "../../content/rules";
import { tokens } from "../../theme";
import Dialog from "../common/AppDialog";
import { byPick, isRevealed, REVEAL_STEP_MS } from "./lottery";

const pop = keyframes`
  from { opacity: 0; transform: translateY(-8px) scale(0.96); }
  to { opacity: 1; transform: none; }
`;

/**
 * The draft order revealed one team at a time, last pick first, after the commissioner
 * randomizes. Skip shows everything at once; the order is already saved either way.
 */
const LotteryReveal = ({ order, onClose }: { order: DraftSlot[]; onClose: () => void }) => {
  const slots = byPick(order);
  const [revealed, setRevealed] = useState(0);
  const done = revealed >= slots.length;

  useEffect(() => {
    if (done) return;
    const timer = window.setInterval(() => setRevealed((count) => count + 1), REVEAL_STEP_MS);
    return () => window.clearInterval(timer);
  }, [done]);

  const latest = slots[slots.length - revealed];

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{LOTTERY.title}</DialogTitle>
      <DialogContent sx={{ display: "grid", gap: 1 }}>
        <Typography color="text.secondary" variant="body2">
          {LOTTERY.subtitle}
        </Typography>
        <Box component="ol" sx={{ m: 0, p: 0, display: "grid", gap: 0.75, listStyle: "none" }}>
          {slots.map((slot) => {
            const shown = isRevealed(slot.slot, slots.length, revealed);
            return (
              <Box
                component="li"
                key={slot.slot}
                sx={{
                  minHeight: 44,
                  px: 1.5,
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                  borderRadius: 1.5,
                  bgcolor: tokens.surfaceRaised,
                  border: `1px solid ${shown ? tokens.accentBorder : tokens.border}`,
                  animation: shown ? `${pop} 400ms ease-out` : undefined,
                }}
              >
                <Typography
                  sx={{ width: 28, fontWeight: 700, color: shown ? tokens.accent : tokens.muted }}
                >
                  {slot.slot}
                </Typography>
                {shown ? (
                  <Typography sx={{ minWidth: 0, overflowWrap: "anywhere" }}>
                    {slot.teamName}
                    {slot.ownerName && (
                      <Typography component="span" variant="caption" color="text.secondary">
                        {` · ${slot.ownerName}`}
                      </Typography>
                    )}
                  </Typography>
                ) : (
                  <Typography color="text.secondary" aria-hidden>
                    ?
                  </Typography>
                )}
              </Box>
            );
          })}
        </Box>
        <Box role="status" sx={{ position: "absolute", width: 1, height: 1, overflow: "hidden" }}>
          {latest && `Pick ${latest.slot}: ${latest.teamName}`}
        </Box>
      </DialogContent>
      <DialogActions>
        {done ? (
          <Button variant="contained" sx={{ minHeight: 44 }} onClick={onClose}>
            {LOTTERY.done}
          </Button>
        ) : (
          <Button sx={{ minHeight: 44 }} onClick={() => setRevealed(slots.length)}>
            {LOTTERY.skip}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default LotteryReveal;
