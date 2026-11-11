import type { Feed, FeedItem, FeedMessageItem, LeagueByUser } from "./types";

/**
 * Responses from an API older than the SPA (a deploy window, a cached reply) can lack the
 * fields added later, or send null. They are filled in here, once, so the types stay honest
 * and no component has to guard.
 */
type Raw<T> = { [K in keyof T]?: T[K] | null };

const normalizeItem = (item: FeedItem): FeedItem => {
  if (item.type !== "message") return item;
  const raw: Raw<FeedMessageItem> = item;
  return {
    ...item,
    reactions: raw.reactions ?? [],
    mentions: raw.mentions ?? [],
    replyTo: raw.replyTo ?? null,
    editedAt: raw.editedAt ?? null,
    gifUrl: raw.gifUrl ?? null,
  };
};

export const normalizeFeed = (feed: Feed): Feed => ({
  ...feed,
  items: (feed.items ?? []).map(normalizeItem),
});

export const normalizeLeague = (league: LeagueByUser): LeagueByUser => ({
  ...league,
  newActivityCount: league.newActivityCount ?? 0,
});
