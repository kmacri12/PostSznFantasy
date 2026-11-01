import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDraftRoom } from "./useDraftRoom";

vi.mock("../contexts/UserContext", () => ({
  useUser: () => ({ getIdToken: async () => "jwt" }),
}));

class FakeSocket {
  static instances: FakeSocket[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code: number; reason: string }) => void) | null = null;
  onerror = null;
  send = vi.fn();
  close = vi.fn();
  constructor() {
    FakeSocket.instances.push(this);
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  receive(message: object) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
  drop() {
    this.readyState = 3;
    this.onclose?.({ code: 1006, reason: "" });
  }
}

const snapshot = {
  draftId: 1,
  seasonId: 7,
  status: "in_progress",
  serverTime: "2030-01-01T00:00:00Z",
  currentPickDeadline: "2030-01-01T00:01:00Z",
  order: [],
  picks: [],
  queue: [],
  presence: [],
  myTeamId: 10,
  onTheClockTeamId: 10,
};
const myPick = {
  id: 1,
  teamId: 10,
  playerId: 5,
  playerName: "P5",
  numberPickOverall: 1,
  autopick: false,
};

describe("useDraftRoom pick flow", () => {
  const originalWebSocket = globalThis.WebSocket;
  beforeEach(() => {
    FakeSocket.instances = [];
    globalThis.WebSocket = Object.assign(FakeSocket, {
      OPEN: 1,
    }) as unknown as typeof WebSocket;
  });
  afterEach(() => {
    globalThis.WebSocket = originalWebSocket;
  });

  const connected = () => {
    const hook = renderHook(() => useDraftRoom("7"));
    const socket = FakeSocket.instances[0] as FakeSocket;
    act(() => socket.open());
    act(() => socket.receive({ eventType: "SNAPSHOT", data: snapshot }));
    return { hook, socket };
  };

  it("goes pending on send and resolves when my pick is broadcast", () => {
    const { hook, socket } = connected();
    act(() => hook.result.current.makePick(5));
    expect(socket.send).toHaveBeenCalledWith(
      JSON.stringify({ eventType: "MAKE_PICK", data: { playerId: 5 } }),
    );
    expect(hook.result.current.pendingPlayerId).toBe(5);

    act(() => socket.receive({ eventType: "PICK_MADE", data: myPick }));
    expect(hook.result.current.pendingPlayerId).toBeNull();
  });

  it("surfaces a toast, not a silent drop, when picking on a dead socket", () => {
    const { hook, socket } = connected();
    act(() => socket.drop());
    act(() => hook.result.current.makePick(5));
    expect(hook.result.current.pendingPlayerId).toBeNull();
    expect(hook.result.current.toast?.message).toMatch(/not sent/i);
  });

  it("clears pending and hides a taken player after a rejection", () => {
    const { hook, socket } = connected();
    act(() => hook.result.current.makePick(5));
    act(() => socket.receive({ eventType: "ERROR", message: "taken", code: "player_taken" }));
    expect(hook.result.current.pendingPlayerId).toBeNull();
    expect(hook.result.current.takenPlayerIds).toEqual([5]);
    expect(hook.result.current.toast?.message).toBe("taken");
  });

  it("returns to server truth when a reconnect delivers a fresh snapshot", () => {
    const { hook, socket } = connected();
    act(() => hook.result.current.makePick(5));
    act(() => socket.drop());
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(FakeSocket.instances).toHaveLength(2);
    const fresh = FakeSocket.instances[1] as FakeSocket;
    act(() => fresh.open());
    act(() => fresh.receive({ eventType: "SNAPSHOT", data: { ...snapshot, picks: [myPick] } }));
    expect(hook.result.current.pendingPlayerId).toBeNull();
    expect(hook.result.current.state?.picks).toHaveLength(1);
  });
});
