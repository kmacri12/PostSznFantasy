import type { InvitePreview } from "../../api/types";

/** Matches the API's join refusal for a league with no open team. */
export const LEAGUE_FULL_REASON = "This league is full";

export type InviteView =
  | { kind: "sign-in" }
  | { kind: "join" }
  | { kind: "full" }
  | { kind: "unavailable"; reason: string };

/** What the invite page offers: sign in, join, the full-league state, or why it can't be used. */
export const inviteView = (preview: InvitePreview, signedIn: boolean): InviteView => {
  if (preview.joinable) return signedIn ? { kind: "join" } : { kind: "sign-in" };
  if (preview.full && (!preview.reason || preview.reason === LEAGUE_FULL_REASON)) {
    return { kind: "full" };
  }
  return { kind: "unavailable", reason: preview.reason ?? "This invite can't be used." };
};

export const commissionerName = (preview: InvitePreview): string | null =>
  preview.members.find((member) => member.isCommissioner)?.displayName ?? null;
