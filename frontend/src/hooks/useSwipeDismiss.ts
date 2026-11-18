import { type TouchEvent, useRef } from "react";
import { prefersReducedMotion } from "./useReducedMotion";

const DISMISS_DISTANCE = 100;
const DISMISS_VELOCITY = 0.5;

/** True when the touch began inside something scrolled away from its top, so the swipe is a scroll. */
const scrolledBelowTop = (target: EventTarget, sheet: HTMLElement): boolean => {
  for (let node = target as HTMLElement | null; node; node = node.parentElement) {
    if (node.scrollTop > 0) return true;
    if (node === sheet) break;
  }
  return false;
};

/**
 * Swipe a bottom sheet down to dismiss it. The drag starts only when the touch begins on content
 * scrolled to its top, so scrolling inside the sheet still works; the sheet follows the finger and
 * closes past a distance or a quick flick, else snaps back. Spread the result on the sheet's paper.
 */
export const useSwipeDismiss = (onClose: () => void) => {
  const sheet = useRef<HTMLElement | null>(null);
  const drag = useRef<{ startY: number; startTime: number; offset: number } | null>(null);

  const setOffset = (offset: number, animate: boolean) => {
    const node = sheet.current;
    if (!node) return;
    node.style.transition = animate && !prefersReducedMotion() ? "transform 0.2s ease-out" : "none";
    node.style.transform = offset > 0 ? `translateY(${offset}px)` : "";
  };

  const finish = (close: boolean) => {
    const current = drag.current;
    drag.current = null;
    if (!current) return;
    if (close) onClose();
    else setOffset(0, true);
  };

  return {
    ref: sheet,
    onTouchStart: (event: TouchEvent<HTMLElement>) => {
      const node = sheet.current;
      if (!node || scrolledBelowTop(event.target, node)) return;
      drag.current = { startY: event.touches[0]?.clientY ?? 0, startTime: Date.now(), offset: 0 };
    },
    onTouchMove: (event: TouchEvent<HTMLElement>) => {
      const current = drag.current;
      if (!current) return;
      current.offset = Math.max(0, (event.touches[0]?.clientY ?? 0) - current.startY);
      setOffset(current.offset, false);
    },
    onTouchEnd: () => {
      const current = drag.current;
      if (!current) return;
      const speed = current.offset / Math.max(1, Date.now() - current.startTime);
      finish(
        current.offset > DISMISS_DISTANCE || (current.offset > 30 && speed > DISMISS_VELOCITY),
      );
    },
    onTouchCancel: () => finish(false),
  };
};
