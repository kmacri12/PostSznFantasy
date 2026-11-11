import { type TouchEvent, useCallback, useRef } from "react";

const LONG_PRESS_MS = 450;
/** A finger that travels farther than this is scrolling, not pressing. */
const MOVE_TOLERANCE_PX = 10;

/**
 * Touch handlers that call `onLongPress` after a still press. Nothing is prevented on the
 * way, so a swipe still scrolls the page; a press that moves, lifts early or is cancelled
 * by the browser (it took over as a scroll) never fires. Desktop and Android's own long
 * press arrive as `contextmenu`, which the caller handles separately.
 */
export function useLongPress(onLongPress: (target: HTMLElement) => void) {
  const timer = useRef<number | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);

  const cancel = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    origin.current = null;
  }, []);

  const onTouchStart = useCallback(
    (event: TouchEvent<HTMLElement>) => {
      const touch = event.touches[0];
      const target = event.currentTarget;
      cancel();
      if (!touch) return;
      origin.current = { x: touch.clientX, y: touch.clientY };
      timer.current = window.setTimeout(() => {
        timer.current = null;
        onLongPress(target);
      }, LONG_PRESS_MS);
    },
    [cancel, onLongPress],
  );

  const onTouchMove = useCallback(
    (event: TouchEvent<HTMLElement>) => {
      const touch = event.touches[0];
      const from = origin.current;
      if (
        touch &&
        from &&
        Math.hypot(touch.clientX - from.x, touch.clientY - from.y) > MOVE_TOLERANCE_PX
      ) {
        cancel();
      }
    },
    [cancel],
  );

  return { onTouchStart, onTouchMove, onTouchEnd: cancel, onTouchCancel: cancel };
}
