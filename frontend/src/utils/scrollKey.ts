import type { Location } from "react-router-dom";

/**
 * Which saved scroll position a page restores. Every page remembers its place by path, so
 * returning to the standings or the player list through a tab lands where the member left off.
 * The Feed is the exception: it opens at its newest message (or the "New" divider), and only
 * back and forward, keyed by history entry, bring back an older position.
 */
export const scrollKey = (location: Pick<Location, "pathname" | "key">): string =>
  /\/feed\/?$/.test(location.pathname) ? location.key : location.pathname;
