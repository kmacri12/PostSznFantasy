import { useCallback, useEffect, useState } from "react";
import { E2E_BUILD } from "../../utils/e2e";

const CONFIRM_WINDOW_MS = E2E_BUILD ? 10 * 60_000 : 3000;

/** The two-tap draft: the first tap arms a player, a second one inside the window picks him. */
export function useConfirmedPick(onPick: ((playerId: number) => void) | undefined) {
  const [armedId, setArmedId] = useState<number | null>(null);

  useEffect(() => {
    if (armedId === null) return;
    const timer = setTimeout(() => setArmedId(null), CONFIRM_WINDOW_MS);
    return () => clearTimeout(timer);
  }, [armedId]);

  const tap = useCallback(
    (id: number) => {
      if (armedId !== id) {
        setArmedId(id);
        return;
      }
      setArmedId(null);
      onPick?.(id);
    },
    [armedId, onPick],
  );

  return { armedId, tap };
}
