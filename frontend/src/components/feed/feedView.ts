import type { FeedEventItem, FeedItem, FeedMessageItem, MessageReaction } from "../../api/types";
import { formatPlainInViewerZone } from "../../utils/timeZone";
import { describeEvent, detailLines } from "../activity/describe";

export const itemKey = (item: FeedItem): string => `${item.type}-${item.id}`;

export type TimelineRow =
  | { type: "date"; key: string; label: string }
  | { type: "new"; key: string }
  | { type: "event"; key: string; item: FeedEventItem }
  | { type: "message"; key: string; item: FeedMessageItem };

const dayLabel = (iso: string): string =>
  formatPlainInViewerZone(iso, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

export const timeLabel = (iso: string): string =>
  formatPlainInViewerZone(iso, { hour: "numeric", minute: "2-digit" }).replace(
    /\s?([AP])M$/i,
    (_, half: string) => ` ${half.toLowerCase()}m`,
  );

/**
 * The feed as the screen draws it: oldest first so the newest sits above the message box,
 * with a date row whenever the day changes and a "New" divider before the first unseen item.
 * `dividerKey` is frozen by the caller when the page opens, so reading does not move it.
 */
export const buildTimeline = (
  newestFirst: FeedItem[],
  dividerKey: string | null,
): TimelineRow[] => {
  const rows: TimelineRow[] = [];
  let day = "";
  for (const item of [...newestFirst].reverse()) {
    if (item.type === "event" && item.kind === "lineup_move") continue;
    const label = dayLabel(item.createdAt);
    if (label !== day) {
      day = label;
      rows.push({ type: "date", key: `date-${itemKey(item)}`, label });
    }
    const key = itemKey(item);
    if (key === dividerKey) rows.push({ type: "new", key: "new" });
    rows.push(
      item.type === "message" ? { type: "message", key, item } : { type: "event", key, item },
    );
  }
  return rows;
};

/** The oldest unseen item, where the "New" divider goes. Null when everything was seen. */
export const firstNewKey = (newestFirst: FeedItem[]): string | null => {
  const unseen = newestFirst.filter((item) => item.isNew);
  const oldest = unseen[unseen.length - 1];
  return oldest ? itemKey(oldest) : null;
};

export interface EventLine {
  /** Set in bold ahead of `text`: the actor, or the kind of event. */
  lead: string | null;
  text: string;
  details: string[];
  /** A commissioner override is flagged. */
  warn: boolean;
  /** The resulting order, shown as a numbered list. */
  order?: string[];
  /** An announcement's text, shown in full under the line. */
  quote?: string;
}

export const COMMISSIONER_ACTION = "Commissioner action";

const LABELLED: Partial<Record<FeedEventItem["kind"], string>> = {
  stat_correction: "Stat correction",
};

/** Events a commissioner causes on behalf of others all lead with the same words. */
const isCommissionerAction = (event: FeedEventItem): boolean => {
  switch (event.kind) {
    case "commissioner_override":
    case "draft_order_randomized":
    case "draft_order_changed":
    case "draft_started":
    case "draft_time_set":
    case "draft_pick_assigned":
    case "settings_change":
    case "role_changed":
      return event.actorName !== null;
    case "membership_left":
      return event.actorName !== null && event.actorUserId !== event.payload.userId;
    default:
      return false;
  }
};

const withoutLead = (sentence: string, lead: string | null): string =>
  lead !== null && sentence.startsWith(lead) ? sentence.slice(lead.length) : sentence;

/** How one event reads in the feed. */
export const eventLine = (event: FeedEventItem): EventLine => {
  const sentence = describeEvent(event);
  const details = detailLines(event);
  const warn = event.kind === "commissioner_override" && event.payload.locked !== false;
  const label = isCommissionerAction(event) ? COMMISSIONER_ACTION : LABELLED[event.kind];
  if (label) {
    const order =
      event.kind === "draft_order_randomized"
        ? [...event.payload.order].sort((a, b) => a.position - b.position).map((s) => s.teamName)
        : undefined;
    return { lead: label, text: ` · ${sentence}`, details, warn, ...(order && { order }) };
  }
  switch (event.kind) {
    case "draft_completed":
      return {
        lead: "Draft completed",
        text: ` · ${event.payload.picks} picks`,
        details,
        warn,
      };
    case "draft_order_randomized":
      return {
        lead: event.actorName,
        text: withoutLead(sentence, event.actorName),
        details,
        warn,
        order: [...event.payload.order]
          .sort((a, b) => a.position - b.position)
          .map((slot) => slot.teamName),
      };
    case "announcement":
      return {
        lead: event.actorName,
        text: withoutLead(sentence, event.actorName),
        details,
        warn,
        quote: event.payload.body,
      };
    case "draft_order_changed": {
      const [headline = "", moves = ""] = sentence.split(": ");
      return {
        lead: event.actorName,
        text: `${withoutLead(headline, event.actorName)} · ${moves}`,
        details,
        warn,
      };
    }
    case "membership_left":
      return {
        lead: event.payload.userName,
        text: withoutLead(sentence, event.payload.userName),
        details,
        warn,
      };
    default:
      return {
        lead: event.actorName,
        text: withoutLead(sentence, event.actorName),
        details,
        warn,
      };
  }
};

/** Who reacted with what, for the message menu: "👍 Dave, Pat · 🔥 Kyle"; empty without reactions. */
export const reactionSummary = (reactions: MessageReaction[]): string =>
  reactions.map((r) => `${r.emoji} ${r.names.join(", ")}`).join(" · ");

/** The server's edit window, so the menu stops offering Edit when it has closed. */
export const EDIT_WINDOW_MS = 5 * 60 * 1000;

export const canStillEdit = (message: FeedMessageItem, now = Date.now()): boolean =>
  message.canEdit && now - new Date(message.createdAt).getTime() <= EDIT_WINDOW_MS;
