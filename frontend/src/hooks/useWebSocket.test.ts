import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWebSocket } from "./useWebSocket";

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  url: string;
  readyState: number = WebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code: number; reason: string }) => void) | null = null;
  onerror: ((err: unknown) => void) | null = null;
  send = vi.fn();
  close = vi.fn((code = 1000, reason = "") => {
    this.readyState = WebSocket.CLOSED;
    if (this.onclose) this.onclose({ code, reason });
  });

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  simulateOpen() {
    this.readyState = WebSocket.OPEN;
    if (this.onopen) this.onopen();
  }

  simulateMessage(data: object | string) {
    if (this.onmessage) {
      const payload = typeof data === "string" ? data : JSON.stringify(data);
      this.onmessage({ data: payload });
    }
  }
}

describe("useWebSocket hook", () => {
  const originalWebSocket = global.WebSocket;

  beforeEach(() => {
    MockWebSocket.instances = [];
    global.WebSocket = MockWebSocket as unknown as typeof WebSocket;
  });

  afterEach(() => {
    global.WebSocket = originalWebSocket;
  });

  it("establishes connection and handles open event", () => {
    const { result } = renderHook(() => useWebSocket("ws://localhost:8000/api/drafts/ws/1"));

    expect(result.current.isConnected).toBe(false);
    expect(MockWebSocket.instances.length).toBe(1);

    act(() => {
      MockWebSocket.instances[0].simulateOpen();
    });

    expect(result.current.isConnected).toBe(true);
  });

  it("receives and parses JSON messages", () => {
    const { result } = renderHook(() => useWebSocket("ws://localhost:8000/api/drafts/ws/1"));
    const wsInstance = MockWebSocket.instances[0];

    act(() => {
      wsInstance.simulateOpen();
      wsInstance.simulateMessage({
        eventType: "PICK_MADE",
        leagueId: 1,
        data: { playerId: 99, teamId: 2 },
      });
    });

    expect(result.current.data).toEqual({
      eventType: "PICK_MADE",
      leagueId: 1,
      data: { playerId: 99, teamId: 2 },
    });
  });

  it("sends JSON payloads when connected", () => {
    const { result } = renderHook(() => useWebSocket("ws://localhost:8000/api/drafts/ws/1"));
    const wsInstance = MockWebSocket.instances[0];

    act(() => {
      wsInstance.simulateOpen();
      result.current.sendMessage({ type: "SYNC_REQUEST", leagueId: 1 });
    });

    expect(wsInstance.send).toHaveBeenCalledWith(
      JSON.stringify({ type: "SYNC_REQUEST", leagueId: 1 }),
    );
  });

  it("handles socket closure", () => {
    const { result } = renderHook(() => useWebSocket("ws://localhost:8000/api/drafts/ws/1"));
    const wsInstance = MockWebSocket.instances[0];

    act(() => {
      wsInstance.simulateOpen();
    });
    expect(result.current.isConnected).toBe(true);

    act(() => {
      wsInstance.close(1000, "Normal closure");
    });
    expect(result.current.isConnected).toBe(false);
  });
});
