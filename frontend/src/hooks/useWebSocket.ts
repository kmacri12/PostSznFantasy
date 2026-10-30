import { useCallback, useEffect, useRef, useState } from "react";
import { createLogger } from "../utils/logger";
import { addBreadcrumb } from "../utils/sentry";

const logger = createLogger("useWebSocket");

export interface DraftMessage {
  eventType: string;
  leagueId?: number;
  message?: string;
  /** Machine-readable reason on ERROR events (e.g. player_taken). */
  code?: string | null;
  /** Shape depends on eventType; consumers narrow it. */
  data?: unknown;
  timestamp?: number | string;
  activeConnections?: number;
}

interface Options {
  getToken?: () => Promise<string | null>;
  onMessage?: (message: DraftMessage) => void;
}

const HEARTBEAT_MS = 20_000;
// Mobile browsers freeze sockets in the background without closing them, so silence means dead.
const DEAD_AFTER_MS = 2 * HEARTBEAT_MS;
const BASE_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;
const NORMAL_CLOSURE = 1000;
// The server closes with 1008 when auth or league membership fails; retrying cannot help.
const POLICY_VIOLATION = 1008;

export const backoffDelay = (attempt: number): number =>
  Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS);

export const useWebSocket = (url: string, options: Options = {}) => {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);

  // Refs keep unstable caller-supplied functions from forcing reconnects.
  const getTokenRef = useRef(options.getToken);
  const onMessageRef = useRef(options.onMessage);
  getTokenRef.current = options.getToken;
  onMessageRef.current = options.onMessage;

  useEffect(() => {
    if (!url) return;

    let disposed = false;
    let attempt = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
    let lastHeardAt = Date.now();

    const connect = () => {
      lastHeardAt = Date.now();
      const socket = new WebSocket(url);
      socketRef.current = socket;

      socket.onopen = () => {
        attempt = 0;
        setIsConnected(true);
        addBreadcrumb("draft.connection", "connected");
        logger.info("Connection established", url);

        // The server expects credentials as the first message (kept out of the URL).
        getTokenRef.current?.().then((token) => {
          if (token && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ eventType: "AUTH", token }));
          }
        });

        heartbeatTimer = setInterval(() => {
          if (Date.now() - lastHeardAt > DEAD_AFTER_MS) {
            logger.warn("No traffic from server; reconnecting");
            reconnectNow();
            return;
          }
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ eventType: "PING", timestamp: Date.now() }));
          }
        }, HEARTBEAT_MS);
      };

      socket.onmessage = (event) => {
        lastHeardAt = Date.now();
        try {
          onMessageRef.current?.(JSON.parse(event.data) as DraftMessage);
        } catch {
          logger.warn("Protocol mismatch: received non-JSON payload", event.data);
        }
      };

      socket.onclose = (event) => {
        setIsConnected(false);
        addBreadcrumb("draft.connection", "closed", { code: event.code });
        clearInterval(heartbeatTimer);
        logger.info("Connection closed", event.code, event.reason);

        if (disposed || event.code === NORMAL_CLOSURE || event.code === POLICY_VIOLATION) {
          return;
        }
        const delay = backoffDelay(attempt++);
        logger.info(`Reconnecting in ${delay}ms`);
        addBreadcrumb("draft.connection", "reconnecting", { delay });
        reconnectTimer = setTimeout(connect, delay);
      };

      socket.onerror = (error) => {
        logger.error("Socket error", error);
      };
    };

    // Replaces the socket outright; the server's snapshot on connect is the resync.
    const reconnectNow = () => {
      addBreadcrumb("draft.connection", "resync");
      clearTimeout(reconnectTimer);
      clearInterval(heartbeatTimer);
      const stale = socketRef.current;
      if (stale) {
        stale.onopen = stale.onmessage = stale.onclose = null;
        stale.close(NORMAL_CLOSURE, "Resync");
      }
      attempt = 0;
      setIsConnected(false);
      connect();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") reconnectNow();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("online", reconnectNow);
    connect();

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("online", reconnectNow);
      disposed = true;
      clearTimeout(reconnectTimer);
      clearInterval(heartbeatTimer);
      socketRef.current?.close(NORMAL_CLOSURE, "Component unmounted");
    };
  }, [url]);

  /** Returns false when the socket is down so callers can surface the dropped message. */
  const sendMessage = useCallback((message: object): boolean => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
      return true;
    }
    logger.warn("Dropped outbound message: socket is not open");
    return false;
  }, []);

  return { isConnected, sendMessage };
};
