import type { RosterPlayer } from "../../api/types";

export const BENCH_SLOT = "BENCH";

export const slotDropId = (index: number) => `slot-${index}`;
export const playerDragId = (playerId: number) => `player-${playerId}`;

/** Reads a finished drag back into a move request, or null when it isn't one. */
export function parseMove(
  activeId: string | number,
  overId: string | number | null | undefined,
): { playerId: number; slotIndex: number } | null {
  const player = /^player-(\d+)$/.exec(String(activeId));
  const slot = /^slot-(\d+)$/.exec(String(overId ?? ""));
  if (!player?.[1] || !slot?.[1]) return null;
  return { playerId: Number(player[1]), slotIndex: Number(slot[1]) };
}

const kickoff = (epoch: string | null): string | null => {
  const seconds = Number(epoch);
  return Number.isFinite(seconds) && seconds > 0
    ? new Date(seconds * 1000).toLocaleString(undefined, {
        weekday: "short",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;
};

export const nextGameText = (player: RosterPlayer): string => {
  if (!player.isActive) return "Eliminated";
  if (!player.nextGame) return "No upcoming game";
  const when = kickoff(player.nextGame.gameTimeEpoch);
  return `vs ${player.nextGame.opponentAbv ?? "TBD"}${when ? ` · ${when}` : ""}`;
};
