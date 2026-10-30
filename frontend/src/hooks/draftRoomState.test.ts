import { describe, expect, it } from "vitest";
import type { DraftPick, DraftSnapshot } from "../api/types";
import {
  applyDraftEvent,
  initialRoom,
  secondsRemaining,
  secondsUntilStart,
} from "./draftRoomState";

const snapshot = (overrides: Partial<DraftSnapshot> = {}): DraftSnapshot => ({
  draftId: 1,
  leagueId: 7,
  status: "in_progress",
  startTime: null,
  draftType: "snake",
  rounds: 2,
  timePerPickSeconds: 60,
  pickTimeoutAction: "queue_then_best_available",
  pickStartedAt: null,
  currentPickDeadline: "2030-01-01T00:01:00Z",
  pausedRemainingSeconds: null,
  serverTime: "2030-01-01T00:00:00Z",
  orderLocked: true,
  order: [],
  unassignedTeamIds: [],
  picks: [],
  totalPicks: 4,
  currentPickOverall: 1,
  onTheClockTeamId: 10,
  onDeckTeamId: 11,
  queue: [5, 6],
  presence: [],
  myTeamId: 10,
  ...overrides,
});

const pick = (overall: number, playerId: number): DraftPick => ({
  id: overall,
  draftId: 1,
  teamId: 10,
  playerId,
  playerName: `P${playerId}`,
  position: "QB",
  numberRound: 1,
  numberPickOverall: overall,
  numberPickInRound: overall,
  autopick: false,
});

const NOW = new Date("2030-01-01T00:00:00Z").getTime();

describe("draft room reducer", () => {
  it("tracks a submitted pick as pending until my team's pick lands", () => {
    let room = applyDraftEvent(initialRoom, { eventType: "SNAPSHOT", data: snapshot() });
    room = applyDraftEvent(room, { eventType: "PICK_PENDING", data: { playerId: 5 } });
    expect(room.pendingPlayerId).toBe(5);
    room = applyDraftEvent(room, { eventType: "PICK_MADE", data: { ...pick(1, 7), teamId: 99 } });
    expect(room.pendingPlayerId).toBe(5);
    room = applyDraftEvent(room, { eventType: "PICK_MADE", data: pick(1, 5) });
    expect(room.pendingPlayerId).toBeNull();
  });

  it("clears a pending pick when someone else drafts that player", () => {
    let room = applyDraftEvent(initialRoom, { eventType: "SNAPSHOT", data: snapshot() });
    room = applyDraftEvent(room, { eventType: "PICK_PENDING", data: { playerId: 5 } });
    room = applyDraftEvent(room, { eventType: "PICK_MADE", data: { ...pick(1, 5), teamId: 99 } });
    expect(room.pendingPlayerId).toBeNull();
  });

  it("clears a pending pick on ERROR and on a fresh snapshot", () => {
    let room = applyDraftEvent(initialRoom, { eventType: "SNAPSHOT", data: snapshot() });
    room = applyDraftEvent(room, { eventType: "PICK_PENDING", data: { playerId: 5 } });
    expect(
      applyDraftEvent(room, { eventType: "ERROR", message: "nope" }).pendingPlayerId,
    ).toBeNull();
    expect(
      applyDraftEvent(room, { eventType: "SNAPSHOT", data: snapshot() }).pendingPlayerId,
    ).toBeNull();
  });

  it("loads a snapshot and records the server clock offset", () => {
    const room = applyDraftEvent(
      initialRoom,
      { eventType: "SNAPSHOT", data: snapshot() },
      NOW - 5000,
    );
    expect(room.state?.leagueId).toBe(7);
    expect(room.clockOffsetMs).toBe(5000);
  });

  it("re-syncs the clock offset on every snapshot", () => {
    let room = applyDraftEvent(
      initialRoom,
      { eventType: "SNAPSHOT", data: snapshot() },
      NOW - 5000,
    );
    room = applyDraftEvent(room, { eventType: "SNAPSHOT", data: snapshot() }, NOW - 800);
    expect(room.clockOffsetMs).toBe(800);
  });

  it("ignores incremental events until a snapshot arrives", () => {
    const room = applyDraftEvent(initialRoom, { eventType: "PICK_MADE", data: pick(1, 5) });
    expect(room).toBe(initialRoom);
  });

  it("replaces a stale snapshot wholesale on reconnect", () => {
    let room = applyDraftEvent(initialRoom, { eventType: "SNAPSHOT", data: snapshot() });
    room = applyDraftEvent(room, { eventType: "PICK_MADE", data: pick(1, 5) });
    room = applyDraftEvent(room, {
      eventType: "SNAPSHOT",
      data: snapshot({ picks: [pick(1, 5), pick(2, 9)] }),
    });
    expect(room.state?.picks).toHaveLength(2);
  });

  it("appends a pick once, even when the event is replayed, and clears it from the queue", () => {
    let room = applyDraftEvent(initialRoom, { eventType: "SNAPSHOT", data: snapshot() });
    room = applyDraftEvent(room, { eventType: "PICK_MADE", data: pick(1, 5) });
    room = applyDraftEvent(room, { eventType: "PICK_MADE", data: pick(1, 5) });
    expect(room.state?.picks).toHaveLength(1);
    expect(room.state?.queue).toEqual([6]);
  });

  it("merges DRAFT_STATE while keeping the viewer's own queue and team", () => {
    let room = applyDraftEvent(initialRoom, { eventType: "SNAPSHOT", data: snapshot() });
    const next = snapshot({
      status: "paused",
      currentPickDeadline: null,
      pausedRemainingSeconds: 33,
    });
    const { queue: _queue, myTeamId: _team, presence: _presence, ...stateOnly } = next;
    room = applyDraftEvent(room, { eventType: "DRAFT_STATE", data: stateOnly });
    expect(room.state?.status).toBe("paused");
    expect(room.state?.queue).toEqual([5, 6]);
    expect(room.state?.myTeamId).toBe(10);
  });

  it("tracks presence, errors and completion", () => {
    let room = applyDraftEvent(initialRoom, { eventType: "SNAPSHOT", data: snapshot() });
    room = applyDraftEvent(room, { eventType: "PRESENCE", data: [1, 2] });
    room = applyDraftEvent(room, { eventType: "ERROR", message: "It is not your turn to pick" });
    room = applyDraftEvent(room, { eventType: "DRAFT_COMPLETE" });
    expect(room.state?.presence).toEqual([1, 2]);
    expect(room.toast?.message).toBe("It is not your turn to pick");
    expect(room.complete).toBe(true);
  });

  it("gives each error its own toast id so a repeat re-shows, and dismisses on request", () => {
    let room = applyDraftEvent(initialRoom, { eventType: "SNAPSHOT", data: snapshot() });
    room = applyDraftEvent(room, { eventType: "ERROR", message: "Your roster is full" });
    const first = room.toast?.id;
    room = applyDraftEvent(room, { eventType: "ERROR", message: "Your roster is full" });
    expect(room.toast?.id).not.toBe(first);
    room = applyDraftEvent(room, { eventType: "DISMISS_TOAST" });
    expect(room.toast).toBeNull();
  });

  it("removes a player from the list when the server says they were taken", () => {
    let room = applyDraftEvent(initialRoom, { eventType: "SNAPSHOT", data: snapshot() });
    room = applyDraftEvent(room, { eventType: "PICK_PENDING", data: { playerId: 5 } });
    room = applyDraftEvent(room, {
      eventType: "ERROR",
      message: "Player has already been drafted",
      code: "player_taken",
    });
    expect(room.takenPlayerIds).toEqual([5]);
    expect(room.pendingPlayerId).toBeNull();
    room = applyDraftEvent(room, { eventType: "SNAPSHOT", data: snapshot() });
    expect(room.takenPlayerIds).toEqual([]);
  });
});

describe("server-authoritative clock", () => {
  it("counts down to the server deadline, not from the page load", () => {
    const state = snapshot();
    expect(secondsRemaining(state, 0, NOW)).toBe(60);
    // Reloading 25s later still shows the true remaining time.
    expect(secondsRemaining(state, 0, NOW + 25_000)).toBe(35);
  });

  it("corrects for a client clock that is ahead or behind the server", () => {
    const state = snapshot();
    expect(secondsRemaining(state, -10_000, NOW + 10_000)).toBe(60);
  });

  it("never goes negative and shows the frozen time while paused", () => {
    expect(secondsRemaining(snapshot(), 0, NOW + 999_000)).toBe(0);
    expect(
      secondsRemaining(
        snapshot({ status: "paused", currentPickDeadline: null, pausedRemainingSeconds: 41 }),
        0,
        NOW,
      ),
    ).toBe(41);
  });

  it("has no clock before the draft starts", () => {
    expect(
      secondsRemaining(snapshot({ status: "lobby", currentPickDeadline: null }), 0, NOW),
    ).toBeNull();
  });

  it("counts down to the scheduled start while waiting", () => {
    const waiting = snapshot({ status: "scheduled", startTime: "2030-01-01T00:10:00Z" });
    expect(secondsUntilStart(waiting, 0, NOW)).toBe(600);
    expect(secondsUntilStart(snapshot(), 0, NOW)).toBeNull();
  });
});
