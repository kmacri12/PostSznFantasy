import type { LineupPlayer, RoundLineup } from "../../api/types";

export const BENCH_SLOT = "BENCH";
export const UNASSIGNED_DROP_ID = "unassigned";

export const ROUND_LABELS: Record<number, string> = {
  1: "Wild Card",
  2: "Divisional",
  3: "Conference Championship",
  4: "Super Bowl",
};
export const ROUND_TAB_LABELS: Record<number, string> = {
  1: "Wild Card",
  2: "Divisional",
  3: "Conf.",
  4: "Super Bowl",
};

export const slotDropId = (index: number) => `slot-${index}`;
export const playerDragId = (playerId: number) => `player-${playerId}`;

export interface Move {
  playerId: number;
  /** null takes the player out of the lineup. */
  slotIndex: number | null;
}

/** Reads a finished drag back into a move request, or null when it isn't one. */
export function parseMove(
  activeId: string | number,
  overId: string | number | null | undefined,
): Move | null {
  const player = /^player-(\d+)$/.exec(String(activeId));
  if (!player?.[1]) return null;
  if (overId === UNASSIGNED_DROP_ID) return { playerId: Number(player[1]), slotIndex: null };
  const slot = /^slot-(\d+)$/.exec(String(overId ?? ""));
  if (!slot?.[1]) return null;
  return { playerId: Number(player[1]), slotIndex: Number(slot[1]) };
}

const kickoffText = (iso: string): string =>
  new Date(iso).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });

export const formatKickoff = kickoffText;

/** One line under a player's name: why they can or cannot move, and when they lock. */
export const lineupStatusText = (player: LineupPlayer): string => {
  if (player.status === "eliminated") return "Eliminated";
  if (player.status === "bye") return "Bye · scores 0";
  if (!player.kickoff) return "Game not scheduled yet";
  return player.locked
    ? `Locked · kicked off ${kickoffText(player.kickoff)}`
    : `Locks at kickoff · ${kickoffText(player.kickoff)}`;
};

export interface TapResult {
  selectedPlayerId: number | null;
  move: Move | null;
}

/**
 * Tap-to-move: the first tap picks an unlocked player up, the next tap on any other slot
 * moves or swaps them there, and tapping the picked-up player again puts them back down.
 * A locked player is never picked up and a locked occupant is never swapped out; the
 * server enforces the same rule.
 */
export function applyTap(
  selectedPlayerId: number | null,
  slot: { index: number | null; playerId: number | null; locked: boolean },
): TapResult {
  if (selectedPlayerId === null) {
    return { selectedPlayerId: slot.locked ? null : slot.playerId, move: null };
  }
  if (slot.playerId === selectedPlayerId) return { selectedPlayerId: null, move: null };
  if (slot.locked) return { selectedPlayerId, move: null };
  return { selectedPlayerId: null, move: { playerId: selectedPlayerId, slotIndex: slot.index } };
}

export interface EmptyLineupWarning {
  round: number;
  emptyStarterSlots: number;
  firstKickoff: string;
}

/** The nearest round that still has open starter slots before its first kickoff. */
export function emptyLineupWarning(
  lineups: RoundLineup[],
  rosterSize: number,
  now: Date,
): EmptyLineupWarning | null {
  if (rosterSize === 0) return null;
  for (const lineup of lineups) {
    if (!lineup.firstKickoff || new Date(lineup.firstKickoff) <= now) continue;
    if (lineup.emptyStarterSlots === 0) continue;
    return {
      round: lineup.round,
      emptyStarterSlots: lineup.emptyStarterSlots,
      firstKickoff: lineup.firstKickoff,
    };
  }
  return null;
}

/** The round to open on: the first one whose games have not all kicked off yet. */
export function defaultRound(lineups: RoundLineup[], now: Date): number {
  const upcoming = lineups.find(
    (lineup) => lineup.firstKickoff && new Date(lineup.firstKickoff) > now,
  );
  if (upcoming) return upcoming.round;
  const started = lineups.filter((lineup) => lineup.firstKickoff);
  return started.at(-1)?.round ?? 1;
}
