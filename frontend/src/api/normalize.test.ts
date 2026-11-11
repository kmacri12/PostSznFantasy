import { describe, expect, it } from "vitest";
import { normalizeFeed, normalizeLeague } from "./normalize";
import type { Feed, FeedMessageItem, LeagueByUser } from "./types";

const staleMessage = {
  type: "message",
  id: 1,
  createdAt: "2030-01-11T19:00:00Z",
  authorUserId: 4,
  authorName: "Dave",
  body: "hello",
  canDelete: false,
  canEdit: false,
  isNew: false,
} as unknown as FeedMessageItem;

const feedOf = (...items: unknown[]): Feed => ({
  items: items as Feed["items"],
  nextBefore: null,
  hasNew: false,
  canPost: true,
});

const first = (feed: Feed) => feed.items[0] as FeedMessageItem;

describe("normalizeFeed", () => {
  it("fills fields an older API does not send", () => {
    const item = first(normalizeFeed(feedOf(staleMessage)));
    expect(item.reactions).toEqual([]);
    expect(item.mentions).toEqual([]);
    expect(item.replyTo).toBeNull();
    expect(item.editedAt).toBeNull();
    expect(item.gifUrl).toBeNull();
  });

  it("turns null into empty", () => {
    const item = first(normalizeFeed(feedOf({ ...staleMessage, reactions: null, mentions: null })));
    expect(item.reactions).toEqual([]);
    expect(item.mentions).toEqual([]);
  });

  it("keeps what is sent and leaves events alone", () => {
    const reactions = [{ emoji: "x", count: 1, mine: true, names: ["Kyle"] }];
    const event = { type: "event", id: 9 };
    const feed = normalizeFeed(feedOf({ ...staleMessage, reactions }, event));
    expect((feed.items[0] as FeedMessageItem).reactions).toEqual(reactions);
    expect(feed.items[1]).toBe(event);
  });
});

describe("normalizeLeague", () => {
  it("defaults the unread count", () => {
    const stale = { id: 1, hasNewActivity: true } as unknown as LeagueByUser;
    expect(normalizeLeague(stale).newActivityCount).toBe(0);
  });
});
