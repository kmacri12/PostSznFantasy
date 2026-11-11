const key = (kind: string, id: string | number) => `postszn-celebrated-${kind}-${id}`;

/** Fails closed: a device that cannot remember never celebrates, so it cannot repeat. */
export const celebrationSeen = (kind: string, id: string | number): boolean => {
  try {
    return localStorage.getItem(key(kind, id)) !== null;
  } catch {
    return true;
  }
};

export const markCelebrationSeen = (kind: string, id: string | number): void => {
  try {
    localStorage.setItem(key(kind, id), "1");
  } catch {
    // Nothing to remember it with; celebrationSeen then keeps it from returning.
  }
};
