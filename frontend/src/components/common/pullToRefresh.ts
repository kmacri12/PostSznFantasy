import type { SyncStatus } from "../../api/types";
import { formatAgo } from "./LiveStatsNotice";

/** How far a pull must travel, in px of indicator, before letting go refreshes. */
export const PULL_THRESHOLD = 64;
/** The indicator never travels further than this, however far the finger goes. */
export const PULL_MAX = 112;
/** Finger travel is damped so the page feels heavy rather than dragged. */
const RESISTANCE = 0.5;

export const pullDistance = (fingerTravel: number): number =>
  Math.min(PULL_MAX, Math.max(0, fingerTravel) * RESISTANCE);

export const shouldRefresh = (distance: number): boolean => distance >= PULL_THRESHOLD;

/** The newest `dataUpdatedAt` among queries; 0 when nothing has loaded. */
export const latestUpdate = (updatedAts: number[]): number =>
  updatedAts.reduce((latest, at) => Math.max(latest, at), 0);

/**
 * What a pull does: reload this screen from our server. Worded around "this screen" so nobody
 * reads it as fetching new NFL stats, which the pull cannot do.
 */
export const screenLine = (
  state: { done: boolean; armed: boolean; updatedAt: number },
  now = Date.now(),
): string => {
  if (state.done) return "This screen is up to date";
  if (state.armed) return "Release to refresh this screen";
  if (state.updatedAt === 0) return "Pull to refresh this screen";
  return `This screen updated ${formatAgo(new Date(state.updatedAt).toISOString(), now)}`;
};

/**
 * When live stats last came in. The server syncs them on a schedule while games are on, so the
 * line says so; null until the status has loaded.
 */
export const liveStatsLine = (
  status: SyncStatus[] | undefined,
  now = Date.now(),
): string | null => {
  if (!status) return null;
  const boxScores = status.find((item) => item.kind === "box_scores");
  if (!boxScores?.lastSyncedAt) return "Live stats auto-sync once games start";
  const ago = formatAgo(boxScores.lastSyncedAt, now);
  return boxScores.budgetExhausted
    ? `Live stats paused for today · synced ${ago}`
    : `Live stats auto-sync during games · synced ${ago}`;
};
