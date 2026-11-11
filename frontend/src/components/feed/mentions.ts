import type { MemberSummary, MessageMention } from "../../api/types";

export const MAX_SUGGESTIONS = 5;

export interface MentionQuery {
  /** Index of the `@` in the text. */
  start: number;
  /** What was typed after it, up to the caret. */
  query: string;
}

/** The `@name` being typed right before the caret, or null when the caret is not in one. */
export const mentionQuery = (text: string, caret: number): MentionQuery | null => {
  const match = /(^|\s)@([^\s@]{0,20})$/.exec(text.slice(0, caret));
  if (!match) return null;
  const query = match[2] ?? "";
  return { start: caret - query.length - 1, query };
};

/** Active members whose name starts with the query, then those that contain it; never yourself. */
export const suggestMembers = (
  members: MemberSummary[],
  query: string,
  selfId: number | null,
): MemberSummary[] => {
  const needle = query.toLowerCase();
  const others = members.filter((member) => member.userId !== selfId);
  const starts = others.filter((member) => member.username.toLowerCase().startsWith(needle));
  const contains = others.filter(
    (member) =>
      !member.username.toLowerCase().startsWith(needle) &&
      member.username.toLowerCase().includes(needle),
  );
  return [...starts, ...contains].slice(0, MAX_SUGGESTIONS);
};

/** Replaces the `@query` being typed with the full `@name ` and returns the new text and caret. */
export const insertMention = (
  text: string,
  caret: number,
  mention: MentionQuery,
  name: string,
): { text: string; caret: number } => {
  const inserted = `@${name} `;
  return {
    text: text.slice(0, mention.start) + inserted + text.slice(caret),
    caret: mention.start + inserted.length,
  };
};

/** The tagged members whose `@name` is still in the text (the server drops the rest too). */
export const stillMentioned = (text: string, picked: Map<number, string>): number[] => {
  const lowered = text.toLowerCase();
  return [...picked]
    .filter(([, name]) => lowered.includes(`@${name.toLowerCase()}`))
    .map(([id]) => id);
};

export interface BodySegment {
  text: string;
  mention: boolean;
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The message text cut into plain and `@name` runs, so tagged names can be set in bold. */
export const segmentBody = (body: string, mentions: MessageMention[]): BodySegment[] => {
  if (mentions.length === 0) return [{ text: body, mention: false }];
  // Longest first so "@Dave Smith" wins over "@Dave".
  const names = mentions
    .map((mention) => escapeRegExp(`@${mention.name}`))
    .sort((a, b) => b.length - a.length);
  const pattern = new RegExp(`(${names.join("|")})`, "gi");
  // With one capture group, split alternates plain text and matches.
  return body
    .split(pattern)
    .map((text, index) => ({ text, mention: index % 2 === 1 }))
    .filter((segment) => segment.text !== "");
};
