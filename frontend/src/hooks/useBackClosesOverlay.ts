import { useContext, useEffect, useRef } from "react";
import { UNSAFE_LocationContext, UNSAFE_NavigationContext } from "react-router-dom";

const STACK_KEY = "overlayStack";

interface OverlayNavigator {
  push: (to: string, state?: unknown, options?: { preventScrollReset?: boolean }) => void;
  go: (delta: number) => void;
}

let nextId = 0;
// Overlays that closed themselves and still owe the history one step back. Settled in one
// microtask so a sheet and a dialog closing together go back once per entry, not racing.
let owedBacks = 0;

const stackOf = (state: unknown): string[] => {
  const stack = (state as Record<string, unknown> | null)?.[STACK_KEY];
  return Array.isArray(stack) ? (stack as string[]) : [];
};

/**
 * Lets the browser or Android back button close a sheet or dialog instead of leaving the page.
 * Call it from a component that is mounted exactly while the overlay is open (or pass `active`).
 * Opening pushes a history entry that carries the overlay in the location state; back pops it
 * and calls `onClose`; closing in the UI pops the entry again so history stays tidy.
 * Does nothing outside a router.
 */
export function useBackClosesOverlay(onClose: () => void, active = true): void {
  const navigation = useContext(UNSAFE_NavigationContext) as {
    navigator: OverlayNavigator;
  } | null;
  const location = useContext(UNSAFE_LocationContext)?.location ?? null;
  const navigator = navigation?.navigator;
  const locationRef = useRef(location);
  locationRef.current = location;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const idRef = useRef<string | null>(null);
  // True once the pushed entry is current, so the render before the push lands is not read as a back.
  const seen = useRef(false);
  const settled = useRef(false);

  useEffect(() => {
    if (!active || !navigator) return;
    const id = `overlay-${nextId++}`;
    idRef.current = id;
    seen.current = false;
    settled.current = false;
    // Deferred so a StrictMode mount, unmount, mount never pushes twice.
    const timer = window.setTimeout(() => {
      const current = locationRef.current;
      if (!current) return;
      navigator.push(
        `${current.pathname}${current.search}${current.hash}`,
        { ...(current.state as object | null), [STACK_KEY]: [...stackOf(current.state), id] },
        { preventScrollReset: true },
      );
    }, 0);
    return () => {
      window.clearTimeout(timer);
      idRef.current = null;
      if (seen.current && !settled.current) {
        owedBacks += 1;
        queueMicrotask(() => {
          if (owedBacks > 0) navigator.go(-owedBacks);
          owedBacks = 0;
        });
      }
    };
  }, [active, navigator]);

  const id = idRef.current;
  const inStack = id !== null && stackOf(location?.state).includes(id);
  useEffect(() => {
    if (id === null) return;
    if (inStack) {
      seen.current = true;
    } else if (seen.current && !settled.current) {
      // Back, or any other navigation, took the entry away: the overlay is already off history.
      settled.current = true;
      onCloseRef.current();
    }
  }, [id, inStack]);
}
