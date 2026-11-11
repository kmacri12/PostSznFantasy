import { describe, expect, it } from "vitest";
import type { FeedEventItem, FeedItem, FeedMessageItem } from "../../api/types";
import { buildTimeline, eventLine, firstNewKey, itemKey } from "./feedView";

const base = {
  createdAt: "2030-01-11T19:00:00Z",
  teamId: null,
  teamName: null,
  actorUserId: 2,
  actorName: "Kyle",
  isNew: false,
} as const;

const event = (id: number, partial: Partial<FeedEventItem>): FeedEventItem =>
  ({
    type: "event",
    id,
    kind: "league_created",
    payload: { leagueName: "Pals" },
    ...base,
    ...partial,
  }) as FeedEventItem;

const message = (id: number, partial: Partial<FeedMessageItem> = {}): FeedMessageItem => ({
  type: "message",
  id,
  createdAt: "2030-01-11T19:00:00Z",
  authorUserId: 3,
  authorName: "Dave",
  body: "hi",
  gifUrl: null,
  canDelete: false,
  canEdit: false,
  editedAt: null,
  isNew: false,
  replyTo: null,
  mentions: [],
  reactions: [],
  ...partial,
});

describe("buildTimeline", () => {
  it("lists oldest first with a date row per day and hides lineup moves", () => {
    const items: FeedItem[] = [
      message(9, { createdAt: "2030-01-12T19:00:00Z" }),
      event(8, {
        kind: "lineup_move",
        payload: {
          round: 1,
          playerId: 1,
          playerName: "A",
          fromSlot: null,
          toSlot: "QB",
          displaced: null,
          changedSlots: [0],
          byCommissioner: false,
        },
      }),
      event(7, {}),
    ];
    const rows = buildTimeline(items, null);
    expect(rows.map((row) => row.type)).toEqual(["date", "event", "date", "message"]);
    expect(rows.some((row) => row.type === "event" && row.item.kind === "lineup_move")).toBe(false);
  });

  it("puts the New divider before the keyed item", () => {
    const items: FeedItem[] = [message(2), message(1)];
    const rows = buildTimeline(items, itemKey(items[0] as FeedItem));
    expect(rows.map((row) => row.type)).toEqual(["date", "message", "new", "message"]);
  });
});

describe("firstNewKey", () => {
  it("is the oldest unseen item, or null when all were seen", () => {
    const items: FeedItem[] = [message(3, { isNew: true }), event(2, { isNew: true }), message(1)];
    expect(firstNewKey(items)).toBe("event-2");
    expect(firstNewKey([message(1)])).toBeNull();
  });
});

describe("eventLine", () => {
  it("leads with the actor", () => {
    expect(eventLine(event(1, {}))).toMatchObject({
      lead: "Kyle",
      text: " created the league Pals",
    });
  });

  it("flags a commissioner override and labels a stat correction", () => {
    const correction = eventLine(
      event(2, {
        kind: "stat_correction",
        payload: {
          round: 2,
          gameId: "g",
          playerId: 1,
          playerName: "Henry",
          previousPoints: 12,
          newPoints: 14,
        },
      }),
    );
    expect(correction.lead).toBe("Stat correction");
    expect(correction.text).toContain("Henry");
  });

  it("lists the shuffled draft order by position", () => {
    const line = eventLine(
      event(3, {
        kind: "draft_order_randomized",
        payload: {
          order: [
            { position: 2, teamId: 2, teamName: "Sam's Squad" },
            { position: 1, teamId: 1, teamName: "Dave's Dawgs" },
          ],
        },
      }),
    );
    expect(line.text).toBe(" randomized the draft order");
    expect(line.order).toEqual(["Dave's Dawgs", "Sam's Squad"]);
  });

  it("says who moved where after a manual change", () => {
    const line = eventLine(
      event(4, {
        kind: "draft_order_changed",
        payload: {
          moves: [{ teamId: 2, teamName: "Sam's Squad", fromPosition: 2, toPosition: 4 }],
        },
      }),
    );
    expect(line.lead).toBe("Kyle");
    expect(line.text).toBe(" changed the draft order · Sam's Squad moved from 2 to 4");
  });

  it("reports the pick count when the draft completes", () => {
    const line = eventLine(
      event(5, { kind: "draft_completed", actorName: null, payload: { picks: 84 } }),
    );
    expect(line).toMatchObject({ lead: "Draft completed", text: " · 84 picks" });
  });
});
