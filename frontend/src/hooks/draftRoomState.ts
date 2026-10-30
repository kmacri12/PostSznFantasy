import type { DraftPick, DraftSnapshot, DraftState } from "../api/types";
import type { DraftMessage } from "./useWebSocket";

export interface Toast {
  /** Changes on every error so an identical repeat re-shows the toast. */
  id: number;
  message: string;
}

export interface DraftRoom {
  state: DraftSnapshot | null;
  /** Server time minus local time when the last state arrived; corrects the countdown. */
  clockOffsetMs: number;
  toast: Toast | null;
  /** Players the server rejected as already drafted, hidden until a snapshot confirms the picks. */
  takenPlayerIds: number[];
  /** Player whose MAKE_PICK is in flight; resolved by my team's PICK_MADE, ERROR or a new snapshot. */
  pendingPlayerId: number | null;
  complete: boolean;
}

export const initialRoom: DraftRoom = {
  state: null,
  clockOffsetMs: 0,
  toast: null,
  takenPlayerIds: [],
  pendingPlayerId: null,
  complete: false,
};

const withOffset = (room: DraftRoom, serverTime: string, now: number) => ({
  ...room,
  clockOffsetMs: new Date(serverTime).getTime() - now,
});

const mergePick = (picks: DraftPick[], pick: DraftPick): DraftPick[] =>
  picks.some((existing) => existing.numberPickOverall === pick.numberPickOverall)
    ? picks
    : [...picks, pick].sort((a, b) => a.numberPickOverall - b.numberPickOverall);

/** Pure reducer for socket events, so reconnects and replays can't corrupt the room. */
export function applyDraftEvent(room: DraftRoom, event: DraftMessage, now = Date.now()): DraftRoom {
  switch (event.eventType) {
    case "SNAPSHOT": {
      const snapshot = event.data as DraftSnapshot;
      return {
        ...withOffset(room, snapshot.serverTime, now),
        state: snapshot,
        takenPlayerIds: [],
        pendingPlayerId: null,
      };
    }
    case "DRAFT_STATE": {
      if (!room.state) return room;
      const next = event.data as DraftState;
      return {
        ...withOffset(room, next.serverTime, now),
        state: { ...room.state, ...next },
      };
    }
    case "PICK_MADE": {
      if (!room.state) return room;
      const pick = event.data as DraftPick;
      const picks = mergePick(room.state.picks, pick);
      // A queued player that just got drafted (by anyone) leaves everyone's queue.
      return {
        ...room,
        pendingPlayerId:
          pick.teamId === room.state.myTeamId || pick.playerId === room.pendingPlayerId
            ? null
            : room.pendingPlayerId,
        state: {
          ...room.state,
          picks,
          queue: room.state.queue.filter((id) => id !== pick.playerId),
        },
      };
    }
    case "PRESENCE":
      return room.state
        ? { ...room, state: { ...room.state, presence: event.data as number[] } }
        : room;
    case "QUEUE_UPDATED":
      return room.state
        ? { ...room, state: { ...room.state, queue: event.data as number[] } }
        : room;
    case "DRAFT_COMPLETE":
      return { ...room, complete: true };
    case "PICK_PENDING":
      return { ...room, pendingPlayerId: (event.data as { playerId: number }).playerId };
    case "ERROR":
      return {
        ...room,
        pendingPlayerId: null,
        takenPlayerIds:
          event.code === "player_taken" && room.pendingPlayerId !== null
            ? [...room.takenPlayerIds, room.pendingPlayerId]
            : room.takenPlayerIds,
        toast: { id: (room.toast?.id ?? 0) + 1, message: event.message ?? "Something went wrong" },
      };
    case "DISMISS_TOAST":
      return { ...room, toast: null };
    default:
      return room;
  }
}

/** Whole seconds left on the pick clock, from the server deadline (never a local timer). */
export function secondsRemaining(
  state: DraftState | null,
  clockOffsetMs: number,
  now = Date.now(),
): number | null {
  if (!state) return null;
  if (state.status === "paused") return state.pausedRemainingSeconds;
  if (state.status !== "in_progress" || !state.currentPickDeadline) return null;
  const serverNow = now + clockOffsetMs;
  return Math.max(0, Math.ceil((new Date(state.currentPickDeadline).getTime() - serverNow) / 1000));
}

export function secondsUntilStart(
  state: DraftState | null,
  clockOffsetMs: number,
  now = Date.now(),
): number | null {
  if (!state?.startTime || !["scheduled", "lobby"].includes(state.status)) return null;
  return Math.max(
    0,
    Math.ceil((new Date(state.startTime).getTime() - (now + clockOffsetMs)) / 1000),
  );
}
