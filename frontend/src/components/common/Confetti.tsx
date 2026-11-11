import { Box, GlobalStyles } from "@mui/material";
import { useEffect, useMemo } from "react";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { tokens } from "../../theme";

const PIECES = 36;
const DURATION_MS = 3600;

interface Props {
  /** Called when the burst ends by itself or the viewer taps it away (not under reduced motion). Keep it stable. */
  onDone: () => void;
}

/**
 * One burst of confetti over the page: falls once, ends by itself, and a tap anywhere dismisses
 * it early. Never mounts any motion under reduced motion (which the e2e build always reports).
 */
const Confetti = ({ onDone }: Props) => {
  const reduced = useReducedMotion();
  const colors = [tokens.gold, tokens.accent, tokens.green, tokens.red];
  const pieces = useMemo(
    () =>
      Array.from({ length: PIECES }, (_, index) => ({
        left: (index * 100) / PIECES + (index % 3),
        delay: (index % 9) * 90,
        drift: ((index * 37) % 60) - 30,
        color: index % colors.length,
        tall: index % 2 === 0,
      })),
    [colors.length],
  );

  useEffect(() => {
    if (reduced) return;
    const timer = window.setTimeout(onDone, DURATION_MS + 900);
    return () => window.clearTimeout(timer);
  }, [reduced, onDone]);

  if (reduced) return null;
  return (
    <>
      <GlobalStyles
        styles={{
          "@keyframes ps-confetti-fall": {
            from: { transform: "translate3d(0, -12vh, 0) rotate(0deg)", opacity: 1 },
            to: {
              transform: "translate3d(var(--ps-drift), 105vh, 0) rotate(540deg)",
              opacity: 0.9,
            },
          },
        }}
      />
      <Box
        aria-hidden
        data-testid="confetti"
        onClick={onDone}
        sx={{
          position: "fixed",
          inset: 0,
          zIndex: (theme) => theme.zIndex.modal + 1,
          overflow: "hidden",
        }}
      >
        {pieces.map((piece) => (
          <Box
            key={`${piece.left}-${piece.delay}`}
            sx={{
              "--ps-drift": `${piece.drift}px`,
              position: "absolute",
              top: 0,
              left: `${piece.left}%`,
              width: 8,
              height: piece.tall ? 14 : 8,
              borderRadius: piece.tall ? 1 : "50%",
              bgcolor: colors[piece.color],
              animation: `ps-confetti-fall ${DURATION_MS}ms ease-in ${piece.delay}ms 1 both`,
            }}
          />
        ))}
      </Box>
    </>
  );
};

export default Confetti;
