import { describe, expect, it } from "vitest";
import type { InvitePreview } from "../../api/types";
import { commissionerName, inviteView } from "./inviteView";

const preview = (overrides: Partial<InvitePreview> = {}): InvitePreview => ({
  code: "ABC",
  leagueName: "Pals",
  season: 2026,
  openSpots: 2,
  full: false,
  members: [
    { displayName: "Kyle", isCommissioner: true },
    { displayName: "Dave", isCommissioner: false },
  ],
  joinable: true,
  reason: null,
  ...overrides,
});

describe("inviteView", () => {
  it("asks a signed-out visitor to sign in first", () => {
    expect(inviteView(preview(), false)).toEqual({ kind: "sign-in" });
  });
  it("offers Join league to a signed-in visitor", () => {
    expect(inviteView(preview(), true)).toEqual({ kind: "join" });
  });
  it("shows the full state, signed in or not", () => {
    const full = preview({
      full: true,
      openSpots: 0,
      joinable: false,
      reason: "This league is full",
    });
    expect(inviteView(full, true)).toEqual({ kind: "full" });
    expect(inviteView(full, false)).toEqual({ kind: "full" });
  });
  it("explains a revoked invite even on a full league", () => {
    const revoked = preview({
      full: true,
      joinable: false,
      reason: "This invite has been revoked",
    });
    expect(inviteView(revoked, true)).toEqual({
      kind: "unavailable",
      reason: "This invite has been revoked",
    });
  });
  it("names the commissioner", () => {
    expect(commissionerName(preview())).toBe("Kyle");
    expect(commissionerName(preview({ members: [] }))).toBeNull();
  });
});
