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

// Keyed by the sign-in account id, which the e2e harness can seed before the first login.
const skipKey = (accountId: string) => `postszn-name-skipped-${accountId}`;

/** Fails closed: a device that cannot remember never nags. */
export const nameSkipped = (accountId: string): boolean => {
  try {
    return localStorage.getItem(skipKey(accountId)) !== null;
  } catch {
    return true;
  }
};

export const markNameSkipped = (accountId: string): void => {
  try {
    localStorage.setItem(skipKey(accountId), "1");
  } catch {
    // Nothing to remember it with; nameSkipped then keeps the prompt away.
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
