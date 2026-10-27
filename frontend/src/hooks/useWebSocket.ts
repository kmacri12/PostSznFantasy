import { useEffect, useRef, useState } from "react";

interface DraftSyncData {
  board: any[]; // Adjust the type according to your board structure
  pick: any; // Adjust the type according to your pick structure
  time: number; // Time left for the current pick (seconds)
}

export const useWebSocket = (url: string) => {
  const [data, setData] = useState<DraftSyncData | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Open WebSocket connection
    const socket = new WebSocket(url);
    socketRef.current = socket;

    socket.onopen = () => {
      setIsConnected(true);
      console.log("WebSocket connection opened");
    };

    socket.onmessage = (event) => {
      const parsedData: DraftSyncData = JSON.parse(event.data);
      setData(parsedData); // Update the state with the received data
    };

    socket.onclose = () => {
      setIsConnected(false);
      console.log("WebSocket connection closed");
    };

    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    // Cleanup WebSocket connection on unmount
    return () => {
      socket.close();
    };
  }, [url]);

  const sendMessage = (msg: string) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(msg);
    } else {
      console.error("WebSocket is not open.");
    }
  };

  return {
    data,
    isConnected,
    sendMessage,
  };
};
