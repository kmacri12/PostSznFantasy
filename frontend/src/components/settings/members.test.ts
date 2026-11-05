import { describe, expect, it } from "vitest";
import type { MemberSummary } from "../../api/types";
import { initials, isLastCommissioner, removalWarning, toggledRole } from "./members";

const member = (userId: number, role: MemberSummary["role"]): MemberSummary => ({
  userId,
  username: `User ${userId}`,
  role,
  teamId: userId,
  teamName: `Team ${userId}`,
});

describe("isLastCommissioner", () => {
  it("locks the only commissioner", () => {
    const members = [member(1, "commissioner"), member(2, "member")];
    expect(isLastCommissioner(members, 1)).toBe(true);
  });

  it("frees a commissioner once another one exists", () => {
    const members = [member(1, "commissioner"), member(2, "commissioner")];
    expect(isLastCommissioner(members, 1)).toBe(false);
    expect(isLastCommissioner(members, 2)).toBe(false);
  });

  it("never locks a plain member", () => {
    const members = [member(1, "commissioner"), member(2, "member")];
    expect(isLastCommissioner(members, 2)).toBe(false);
  });
});

describe("toggledRole", () => {
  it("flips between the two roles", () => {
    expect(toggledRole(member(1, "commissioner"))).toBe("member");
    expect(toggledRole(member(2, "member"))).toBe("commissioner");
  });
});

describe("copy helpers", () => {
  it("names the member in the removal warning", () => {
    expect(removalWarning("Dave")).toContain("Remove Dave from the league?");
  });

  it("builds two-letter initials", () => {
    expect(initials(" dave")).toBe("DA");
  });
});
