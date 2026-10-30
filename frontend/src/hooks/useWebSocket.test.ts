import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { backoffDelay, useWebSocket } from "./useWebSocket";

const URL = "ws://localhost:8000/api/drafts/ws/1";

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 3;
  static instances: MockWebSocket[] = [];
  url: string;
  readyState: number = MockWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code: number; reason: string }) => void) | null = null;
  onerror: ((err: unknown) => void) | null = null;
  send = vi.fn();
  close = vi.fn((code = 1000, reason = "") => {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code, reason });
  });

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }

  simulateMessage(data: object | string) {
    this.onmessage?.({ data: typeof data === "string" ? data : JSON.stringify(data) });
  }

  simulateDrop(code = 1006) {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code, reason: "" });
  }
}

const socketAt = (index: number): MockWebSocket => {
  const socket = MockWebSocket.instances[index];
  if (!socket) throw new Error(`no socket #${index}`);
  return socket;
};

describe("useWebSocket hook", () => {
  const originalWebSocket = globalThis.WebSocket;

  beforeEach(() => {
    vi.useFakeTimers();
    MockWebSocket.instances = [];
    globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.WebSocket = originalWebSocket;
  });

  it("tracks connection state", () => {
    const { result } = renderHook(() => useWebSocket(URL));
    expect(result.current.isConnected).toBe(false);

    act(() => socketAt(0).simulateOpen());
    expect(result.current.isConnected).toBe(true);
  });

  it("delivers every message to the callback, not just the latest", () => {
    const onMessage = vi.fn();
    renderHook(() => useWebSocket(URL, { onMessage }));
    const socket = socketAt(0);

    act(() => {
      socket.simulateOpen();
      socket.simulateMessage({ eventType: "PICK_MADE", data: { playerId: 1 } });
      socket.simulateMessage({ eventType: "PICK_MADE", data: { playerId: 2 } });
      socket.simulateMessage("not json");
    });

    expect(onMessage).toHaveBeenCalledTimes(2);
    expect(onMessage.mock.calls[1]?.[0].data.playerId).toBe(2);
  });

  it("authenticates with the token as the first message", async () => {
    const getToken = vi.fn().mockResolvedValue("jwt");
    renderHook(() => useWebSocket(URL, { getToken }));
    const socket = socketAt(0);

    await act(async () => socket.simulateOpen());

    expect(socket.send).toHaveBeenCalledWith(JSON.stringify({ eventType: "AUTH", token: "jwt" }));
  });

  it("does not reconnect when each render passes new callbacks", () => {
    const { rerender } = renderHook(() =>
      useWebSocket(URL, { getToken: async () => "t", onMessage: () => {} }),
    );
    rerender();
    rerender();
    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it("reconnects with exponential backoff after an unclean drop", () => {
    renderHook(() => useWebSocket(URL));

    act(() => socketAt(0).simulateDrop());
    expect(MockWebSocket.instances).toHaveLength(1);
    act(() => vi.advanceTimersByTime(backoffDelay(0)));
    expect(MockWebSocket.instances).toHaveLength(2);

    act(() => socketAt(1).simulateDrop());
    act(() => vi.advanceTimersByTime(backoffDelay(1) - 1));
    expect(MockWebSocket.instances).toHaveLength(2);
    act(() => vi.advanceTimersByTime(1));
    expect(MockWebSocket.instances).toHaveLength(3);
  });

  it("resets the backoff after a successful connection", () => {
    renderHook(() => useWebSocket(URL));
    act(() => socketAt(0).simulateDrop());
    act(() => vi.advanceTimersByTime(backoffDelay(0)));
    act(() => socketAt(1).simulateOpen());
    act(() => socketAt(1).simulateDrop());
    act(() => vi.advanceTimersByTime(backoffDelay(0)));
    expect(MockWebSocket.instances).toHaveLength(3);
  });

  it("caps the backoff delay", () => {
    expect(backoffDelay(20)).toBe(30_000);
  });

  it.each([1000, 1008])("does not reconnect after close code %i", (code) => {
    renderHook(() => useWebSocket(URL));
    act(() => socketAt(0).simulateDrop(code));
    act(() => vi.advanceTimersByTime(60_000));
    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it("does not reconnect after unmount", () => {
    const { unmount } = renderHook(() => useWebSocket(URL));
    unmount();
    act(() => vi.advanceTimersByTime(60_000));
    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it("sends JSON only while the socket is open", () => {
    const { result } = renderHook(() => useWebSocket(URL));
    const socket = socketAt(0);

    let sent = true;
    act(() => {
      sent = result.current.sendMessage({ eventType: "SYNC_REQUEST" });
    });
    expect(socket.send).not.toHaveBeenCalled();
    expect(sent).toBe(false);

    act(() => socket.simulateOpen());
    act(() => {
      sent = result.current.sendMessage({ eventType: "SYNC_REQUEST" });
    });
    expect(sent).toBe(true);
    expect(socket.send).toHaveBeenCalledWith(JSON.stringify({ eventType: "SYNC_REQUEST" }));
  });

  describe("resync", () => {
    const setVisibility = (state: "visible" | "hidden") => {
      Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    };

    it("opens a fresh connection when the tab becomes visible again", () => {
      renderHook(() => useWebSocket(URL));
      act(() => socketAt(0).simulateOpen());

      act(() => setVisibility("hidden"));
      expect(MockWebSocket.instances).toHaveLength(1);

      act(() => setVisibility("visible"));
      expect(MockWebSocket.instances).toHaveLength(2);
      expect(socketAt(0).close).toHaveBeenCalled();
    });

    it("opens a fresh connection when the network comes back", () => {
      renderHook(() => useWebSocket(URL));
      act(() => socketAt(0).simulateOpen());
      act(() => {
        window.dispatchEvent(new Event("online"));
      });
      expect(MockWebSocket.instances).toHaveLength(2);
    });

    it("does not leave a stray backoff reconnect behind a forced one", () => {
      renderHook(() => useWebSocket(URL));
      act(() => socketAt(0).simulateDrop());
      act(() => {
        window.dispatchEvent(new Event("online"));
      });
      expect(MockWebSocket.instances).toHaveLength(2);
      act(() => vi.advanceTimersByTime(60_000));
      expect(MockWebSocket.instances).toHaveLength(2);
    });

    it("treats silence for two heartbeat intervals as a dead socket", () => {
      renderHook(() => useWebSocket(URL));
      act(() => socketAt(0).simulateOpen());
      act(() => vi.advanceTimersByTime(20_000));
      act(() => socketAt(0).simulateMessage({ eventType: "PONG" }));
      act(() => vi.advanceTimersByTime(40_000));
      expect(MockWebSocket.instances).toHaveLength(1);
      act(() => vi.advanceTimersByTime(20_000));
      expect(MockWebSocket.instances).toHaveLength(2);
    });
  });
});
