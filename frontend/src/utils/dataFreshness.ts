/** When the data on screen was last known good, for the offline banner's "Showing data from 3:42 PM". */
type Listener = () => void;

let freshAt: number | null = null;
const listeners = new Set<Listener>();

/** Epoch ms of the newest answer: now for a live response, the stamp for one the service worker replayed. */
export const recordFresh = (at: number = Date.now()): void => {
  if (freshAt !== null && at <= freshAt) return;
  freshAt = at;
  for (const listener of listeners) listener();
};

export const freshAtSnapshot = (): number | null => freshAt;

export const subscribeFresh = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const resetFresh = (): void => {
  freshAt = null;
};

/** `X-Cached-At` (epoch ms) that `public/sw.js` puts on a response it replays from its cache. */
export const cachedAtOf = (headers: unknown): number | null => {
  const raw = (headers as Record<string, unknown> | undefined)?.["x-cached-at"];
  const value = typeof raw === "string" ? Number(raw) : Number.NaN;
  return Number.isFinite(value) && value > 0 ? value : null;
};

export const formatDataTime = (at: number): string =>
  new Date(at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
