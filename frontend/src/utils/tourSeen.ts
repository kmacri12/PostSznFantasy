const storageKey = (userId: number) => `postszn-tour-seen-${userId}`;

/** Navigation state that a league create leaves behind, so the first-run tour knows it just happened. */
export const CREATED_LEAGUE_STATE = { createdLeague: true } as const;

export const isTourTrigger = (state: unknown): boolean =>
  typeof state === "object" &&
  state !== null &&
  ("joinedLeague" in state || "createdLeague" in state);

/** Fails closed: a device that cannot remember never shows the first-run tour. */
export const tourSeen = (userId: number): boolean => {
  try {
    return localStorage.getItem(storageKey(userId)) !== null;
  } catch {
    return true;
  }
};

export const markTourSeen = (userId: number): void => {
  try {
    localStorage.setItem(storageKey(userId), "1");
  } catch {
    // Nothing to remember it with; tourSeen then keeps the tour from returning.
  }
};
