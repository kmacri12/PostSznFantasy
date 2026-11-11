/** How far a pull must travel, in px of indicator, before letting go refreshes. */
export const PULL_THRESHOLD = 64;
/** The indicator never travels further than this, however far the finger goes. */
export const PULL_MAX = 96;
/** Finger travel is damped so the page feels heavy rather than dragged. */
const RESISTANCE = 0.5;

export const pullDistance = (fingerTravel: number): number =>
  Math.min(PULL_MAX, Math.max(0, fingerTravel) * RESISTANCE);

export const shouldRefresh = (distance: number): boolean => distance >= PULL_THRESHOLD;

/** The newest `dataUpdatedAt` among queries; 0 when nothing has loaded. */
export const latestUpdate = (updatedAts: number[]): number =>
  updatedAts.reduce((latest, at) => Math.max(latest, at), 0);
