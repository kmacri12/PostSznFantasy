import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { keys } from "../api/queries";
import { useUser } from "../contexts/UserContext";
import { currentWsOrigin } from "../utils/wsOrigin";
import { type DraftMessage, useWebSocket } from "./useWebSocket";

/**
 * The Feed's live nudges. The server sends `FEED_CHANGED` without content (`isNew` and
 * `canDelete` are per viewer), so each one just refetches the feed; the page falls back to
 * polling while `isConnected` is false.
 */
export function useFeedLive(seasonId: number | undefined, enabled: boolean) {
  const { getIdToken } = useUser();
  const queryClient = useQueryClient();
  const onMessage = useCallback(
    (message: DraftMessage) => {
      if (message.eventType !== "FEED_CHANGED" || seasonId === undefined) return;
      queryClient.invalidateQueries({ queryKey: keys.feed(seasonId) });
      queryClient.invalidateQueries({ queryKey: keys.userLeagues });
    },
    [queryClient, seasonId],
  );
  const { isConnected } = useWebSocket(
    enabled && seasonId ? `${currentWsOrigin()}/api/seasons/${seasonId}/feed/ws` : "",
    { getToken: getIdToken, onMessage },
  );
  return { isConnected };
}
