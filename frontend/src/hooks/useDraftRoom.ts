import { useCallback, useEffect, useReducer, useState } from "react";
import { useUser } from "../contexts/UserContext";
import { currentWsOrigin } from "../utils/wsOrigin";
import {
  applyDraftEvent,
  type DraftRoom,
  initialRoom,
  secondsRemaining,
  secondsUntilStart,
} from "./draftRoomState";
import { type DraftMessage, useWebSocket } from "./useWebSocket";

/** Live draft room: full snapshot on every (re)connect, then incremental events. */
export function useDraftRoom(seasonId: number | undefined, onRejected?: () => void) {
  const { getIdToken } = useUser();
  const [room, dispatch] = useReducer(
    (current: DraftRoom, event: DraftMessage) => applyDraftEvent(current, event),
    initialRoom,
  );
  const [now, setNow] = useState(() => Date.now());

  const { isConnected, sendMessage } = useWebSocket(
    seasonId ? `${currentWsOrigin()}/api/drafts/ws/${seasonId}` : "",
    { getToken: getIdToken, onMessage: dispatch, onRejected },
  );

  useEffect(() => {
    if (!isConnected) dispatch({ eventType: "CONNECTION_LOST" });
  }, [isConnected]);

  // Only drives re-rendering; the numbers come from the server deadline.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);

  const makePick = useCallback(
    (playerId: number) => {
      if (!sendMessage({ eventType: "MAKE_PICK", data: { playerId } })) {
        dispatch({
          eventType: "ERROR",
          message: "Reconnect to the draft room, then pick again. Your pick was not sent.",
        });
        return;
      }
      dispatch({ eventType: "PICK_PENDING", data: { playerId } });
    },
    [sendMessage],
  );

  const setQueueLocal = useCallback(
    (playerIds: number[]) => dispatch({ eventType: "QUEUE_UPDATED", data: playerIds }),
    [],
  );

  const dismissToast = useCallback(() => dispatch({ eventType: "DISMISS_TOAST" }), []);

  return {
    ...room,
    dismissToast,
    setQueueLocal,
    isConnected,
    makePick,
    secondsLeft: secondsRemaining(room.state, room.clockOffsetMs, now),
    secondsToStart: secondsUntilStart(room.state, room.clockOffsetMs, now),
  };
}
