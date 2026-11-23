import type { User as SupabaseUser } from "@supabase/auth-js";

export const MAX_NAME_LENGTH = 20;

/** The API counts code points, so the SPA must too (`slice` and `maxLength` count UTF-16 units). */
export const trimToCodePoints = (value: string, max = MAX_NAME_LENGTH): string =>
  [...value.trim()].slice(0, max).join("");

/** Why a display name can't be saved, or null. Mirrors the API's rules. */
export const nameProblem = (name: string): string | null => {
  const trimmed = name.trim();
  if (trimmed === "") return "Enter a name.";
  if ([...trimmed].length > MAX_NAME_LENGTH) return `Use ${MAX_NAME_LENGTH} characters or fewer.`;
  if (/\p{C}/u.test(trimmed)) return "Names can't contain control characters.";
  return null;
};

/** The name the sign-in provider gave (Google). Never the email: names are shown to other members. */
export const providerName = (user: SupabaseUser | null): string | undefined => {
  const raw = user?.user_metadata?.full_name ?? user?.user_metadata?.name;
  const name = typeof raw === "string" ? trimToCodePoints(raw) : "";
  return name !== "" && nameProblem(name) === null ? name : undefined;
};

/** The team name a member's display name suggests: "Team Kyle" from "Kyle Macri". */
export const suggestedTeamName = (displayName: string | null | undefined): string => {
  const first = (displayName ?? "").trim().split(/\s+/)[0] ?? "";
  return first === "" ? "" : `Team ${trimToCodePoints(first)}`;
};

/** The "Team 3" a team is created with, before anyone names it. */
export const isDefaultTeamName = (name: string | null | undefined): boolean =>
  /^Team \d+$/.test(name ?? "");

// Keyed by the sign-in account id. Only the e2e build reads it: the harness seeds it so specs start
// past "What should we call you?", which nobody else can skip.
const skipKey = (accountId: string) => `postszn-name-skipped-${accountId}`;

export const nameSkipped = (accountId: string): boolean => {
  try {
    return localStorage.getItem(skipKey(accountId)) !== null;
  } catch {
    return true;
  }
};

const teamKey = (teamId: number) => `postszn-team-name-prompted-${teamId}`;

export const teamNamePrompted = (teamId: number): boolean => {
  try {
    return localStorage.getItem(teamKey(teamId)) !== null;
  } catch {
    return true;
  }
};

export const markTeamNamePrompted = (teamId: number): void => {
  try {
    localStorage.setItem(teamKey(teamId), "1");
  } catch {
    // See nameSkipped.
  }
};
