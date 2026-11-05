/**
 * When the notification opt-in may appear. The owner's rule: never pepper members, so at
 * most two prompts per device, ever, and the second only on a different day than the first.
 * Everything fails closed: if the device cannot remember what it showed, it shows nothing.
 */
export const PROMPT_STORAGE_KEY = "postszn-notification-prompt";
export const MAX_PROMPTS = 2;

export interface PromptRecord {
  shown: number;
  /** Local calendar day (YYYY-MM-DD) of the latest prompt. */
  lastDay: string | null;
  /** They turned notifications on from the prompt, so it never returns. */
  accepted: boolean;
}

const EMPTY_RECORD: PromptRecord = { shown: 0, lastDay: null, accepted: false };

export const localDay = (date: Date = new Date()): string =>
  [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");

const isRecord = (value: unknown): value is PromptRecord => {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    Number.isInteger(record.shown) &&
    (record.lastDay === null || typeof record.lastDay === "string") &&
    typeof record.accepted === "boolean"
  );
};

/** The stored record, a fresh one on a first visit, or null when storage can't be trusted. */
export const readPromptRecord = (): PromptRecord | null => {
  try {
    const raw = localStorage.getItem(PROMPT_STORAGE_KEY);
    if (raw === null) return EMPTY_RECORD;
    const parsed: unknown = JSON.parse(raw);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const writePromptRecord = (record: PromptRecord): boolean => {
  try {
    localStorage.setItem(PROMPT_STORAGE_KEY, JSON.stringify(record));
    return readPromptRecord()?.shown === record.shown;
  } catch {
    return false;
  }
};

export const mayPrompt = (record: PromptRecord | null, today: string): boolean =>
  record !== null &&
  !record.accepted &&
  (record.shown === 0 || (record.shown < MAX_PROMPTS && record.lastDay !== today));

/** Counts a prompt before it opens; false means it could not be remembered, so don't show it. */
export const recordPromptShown = (today: string): boolean => {
  const record = readPromptRecord();
  if (!mayPrompt(record, today) || record === null) return false;
  return writePromptRecord({ ...record, shown: record.shown + 1, lastDay: today });
};

export const recordPromptAccepted = (): void => {
  const record = readPromptRecord();
  if (record !== null) writePromptRecord({ ...record, accepted: true });
};

/** Not while someone is drafting, signing in, reading an invite or creating a league. */
export const promptRouteAllowed = (pathname: string): boolean =>
  !/(^|\/)draft(\/|$)/.test(pathname) && !/^\/(sign-in|join|create-league)(\/|$)/.test(pathname);

/** Navigation state a successful join leaves behind, so the prompt knows it just happened. */
export const JOINED_LEAGUE_STATE = { joinedLeague: true } as const;

export const isJoinedLeague = (state: unknown): boolean =>
  typeof state === "object" && state !== null && "joinedLeague" in state;
