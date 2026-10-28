import { useEffect, useRef, useState, useCallback } from "react";

export interface DraftMessage {
  eventType?: string;
  type?: string;
  leagueId?: number;
  message?: string;
  data?: any;
  timestamp?: number | string;
  activeConnections?: number;
}

export const useWebSocket = (url: string) => {
  const [data, setData] = useState<DraftMessage | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (!url) return;

    try {
      const socket = new WebSocket(url);
      socketRef.current = socket;

      socket.onopen = () => {
        setIsConnected(true);
        console.log("Draft WebSocket connection established");

        // Send periodic heartbeat ping
        if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "PING", timestamp: Date.now() }));
          }
        }, 20000);
      };

      socket.onmessage = (event) => {
        try {
          const parsedData: DraftMessage = JSON.parse(event.data);
          setData(parsedData);
        } catch (e) {
          console.warn("Received non-JSON message:", event.data);
        }
      };

      socket.onclose = (event) => {
        setIsConnected(false);
        if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
        console.log("Draft WebSocket connection closed:", event.code, event.reason);

        // Reconnect backoff unless closed cleanly
        if (event.code !== 1000) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log("Attempting WebSocket reconnection...");
            connect();
          }, 3000);
        }
      };

      socket.onerror = (error) => {
        console.error("Draft WebSocket error:", error);
      };
    } catch (err) {
      console.error("Failed to construct WebSocket:", err);
    }
  }, [url]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      if (socketRef.current) {
        socketRef.current.close(1000, "Component unmounted");
      }
    };
  }, [connect]);

  const sendMessage = useCallback((msg: object | string) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      const payload = typeof msg === "string" ? msg : JSON.stringify(msg);
      socketRef.current.send(payload);
    } else {
      console.error("Draft WebSocket is not open.");
    }
  }, []);

  return {
    data,
    isConnected,
    sendMessage,
  };
};
