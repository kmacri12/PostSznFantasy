import { useCallback, useEffect, useRef, useState } from "react";
import { createLogger } from "../utils/logger";

const logger = createLogger("useWebSocket");

export interface DraftMessage {
  eventType: string;
  leagueId?: number;
  message?: string;
  // biome-ignore lint/suspicious/noExplicitAny: payload shape depends on eventType
  data?: any;
  timestamp?: number | string;
  activeConnections?: number;
}

interface Options {
  getToken?: () => Promise<string | null>;
  onMessage?: (message: DraftMessage) => void;
}

const HEARTBEAT_MS = 20_000;
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

    const connect = () => {
      const socket = new WebSocket(url);
      socketRef.current = socket;

      socket.onopen = () => {
        attempt = 0;
        setIsConnected(true);
        logger.info("Connection established", url);

        // The server expects credentials as the first message (kept out of the URL).
        getTokenRef.current?.().then((token) => {
          if (token && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ eventType: "AUTH", token }));
          }
        });

        heartbeatTimer = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ eventType: "PING", timestamp: Date.now() }));
          }
        }, HEARTBEAT_MS);
      };

      socket.onmessage = (event) => {
        try {
          onMessageRef.current?.(JSON.parse(event.data) as DraftMessage);
        } catch {
          logger.warn("Protocol mismatch: received non-JSON payload", event.data);
        }
      };

      socket.onclose = (event) => {
        setIsConnected(false);
        clearInterval(heartbeatTimer);
        logger.info("Connection closed", event.code, event.reason);

        if (disposed || event.code === NORMAL_CLOSURE || event.code === POLICY_VIOLATION) {
          return;
        }
        const delay = backoffDelay(attempt++);
        logger.info(`Reconnecting in ${delay}ms`);
        reconnectTimer = setTimeout(connect, delay);
      };

      socket.onerror = (error) => {
        logger.error("Socket error", error);
      };
    };

    connect();

    return () => {
      disposed = true;
      clearTimeout(reconnectTimer);
      clearInterval(heartbeatTimer);
      socketRef.current?.close(NORMAL_CLOSURE, "Component unmounted");
    };
  }, [url]);

  const sendMessage = useCallback((message: object) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
    } else {
      logger.warn("Dropped outbound message: socket is not open");
    }
  }, []);

  return { isConnected, sendMessage };
};
