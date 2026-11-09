import { Box, Button, Typography } from "@mui/material";
import { type KeyboardEvent, type TouchEvent, useRef, useState } from "react";
import {
  TOUR_BACK,
  TOUR_DONE,
  TOUR_FOOTNOTE,
  TOUR_NEXT,
  TOUR_STAGES,
  TOUR_STAGES_LABEL,
  TOUR_STEPS,
} from "../../content/rules";
import { tokens } from "../../theme";

const SWIPE_PX = 50;

interface Props {
  /** Called from the last step's button; omit where the viewer just sits on a page. */
  onFinish?: () => void;
  /** Leave room for the dialog header when the viewer fills the screen. */
  fill?: boolean;
}

/** The captured screens, one at a time. Touch only: swipe or tap Next and Back. */
const TourViewer = ({ onFinish, fill = false }: Props) => {
  const [index, setIndex] = useState(0);
  const touchX = useRef<number | null>(null);
  const step = TOUR_STEPS[index];
  if (!step) return null;
  const last = index === TOUR_STEPS.length - 1;
  const go = (to: number) => setIndex(Math.min(Math.max(to, 0), TOUR_STEPS.length - 1));

  const onTouchStart = (event: TouchEvent) => {
    touchX.current = event.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (event: TouchEvent) => {
    if (touchX.current === null) return;
    const endX = event.changedTouches[0]?.clientX;
    const dx = endX === undefined ? 0 : endX - touchX.current;
    touchX.current = null;
    if (Math.abs(dx) >= SWIPE_PX) go(index + (dx < 0 ? 1 : -1));
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowRight") go(index + 1);
    if (event.key === "ArrowLeft") go(index - 1);
  };

  return (
    <Box
      role="group"
      aria-roledescription="tour"
      aria-label={step.title}
      onKeyDown={onKeyDown}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      sx={{ display: "grid", gap: 1.5, justifyItems: "center" }}
    >
      {step.stage !== null && (
        <Box
          role="img"
          aria-label={`${TOUR_STAGES_LABEL}: ${TOUR_STAGES[step.stage] ?? ""}, ${step.stage + 1} of ${TOUR_STAGES.length}`}
          sx={{ display: "flex", gap: 0.5, width: "100%", maxWidth: 375 }}
        >
          {TOUR_STAGES.map((stage, stageIndex) => (
            <Box
              key={stage}
              sx={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                bgcolor: stageIndex <= (step.stage ?? 0) ? tokens.accentFill : tokens.border,
              }}
            />
          ))}
        </Box>
      )}
      <Box
        sx={{
          border: 1,
          borderColor: "divider",
          borderRadius: "28px",
          overflow: "hidden",
          lineHeight: 0,
          maxWidth: "100%",
          bgcolor: "background.paper",
        }}
      >
        <Box
          component="img"
          key={step.id}
          src={`/tour/${step.id}.jpg`}
          alt={step.alt}
          width={375}
          height={812}
          sx={{
            display: "block",
            width: "auto",
            height: "auto",
            maxWidth: "100%",
            maxHeight: fill ? "calc(100dvh - 350px)" : "min(60dvh, 560px)",
            userSelect: "none",
          }}
        />
      </Box>
      <Box sx={{ width: "100%", maxWidth: 375, textAlign: "left" }} aria-live="polite">
        <Typography variant="h6" component="h3">
          {step.title}
        </Typography>
        <Typography color="text.secondary">{step.caption}</Typography>
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, width: "100%", maxWidth: 375 }}>
        <Button
          variant="outlined"
          sx={{ minHeight: 48, flex: 1 }}
          disabled={index === 0}
          onClick={() => go(index - 1)}
        >
          {TOUR_BACK}
        </Button>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ minWidth: 40, textAlign: "center" }}
        >
          {index + 1} / {TOUR_STEPS.length}
        </Typography>
        {last && onFinish ? (
          <Button variant="contained" sx={{ minHeight: 48, flex: 1 }} onClick={onFinish}>
            {TOUR_DONE}
          </Button>
        ) : (
          <Button
            variant="contained"
            sx={{ minHeight: 48, flex: 1 }}
            disabled={last}
            onClick={() => go(index + 1)}
          >
            {TOUR_NEXT}
          </Button>
        )}
      </Box>
      <Typography variant="caption" color="text.secondary">
        {TOUR_FOOTNOTE}
      </Typography>
    </Box>
  );
};

export default TourViewer;
