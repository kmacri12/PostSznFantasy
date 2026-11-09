import { describe, expect, it } from "vitest";
import { MAX_NAME_LENGTH, nameProblem, providerName, trimToCodePoints } from "./displayName";

const googleUser = (name: unknown, email = "secret.person@example.com") =>
  ({ email, user_metadata: { full_name: name } }) as never;

describe("nameProblem", () => {
  it("refuses empty, whitespace-only, over-long and control-character names", () => {
    expect(nameProblem("")).not.toBeNull();
    expect(nameProblem("   ")).not.toBeNull();
    expect(nameProblem("x".repeat(MAX_NAME_LENGTH + 1))).not.toBeNull();
    expect(nameProblem("a\u0007b")).not.toBeNull();
    expect(nameProblem("a​b")).not.toBeNull();
  });

  it("counts emoji as one character each, like the API", () => {
    expect(nameProblem("🏈".repeat(MAX_NAME_LENGTH))).toBeNull();
    expect(nameProblem("🏈".repeat(MAX_NAME_LENGTH + 1))).not.toBeNull();
  });
});

describe("trimToCodePoints", () => {
  it("never cuts an emoji in half", () => {
    const cut = trimToCodePoints(`${"a".repeat(19)}🏈🏈`);
    expect([...cut]).toHaveLength(20);
    expect(cut.endsWith("🏈")).toBe(true);
  });
});

describe("providerName", () => {
  it("uses the provider's name, trimmed and cut to length", () => {
    expect(providerName(googleUser("  Pat  "))).toBe("Pat");
    expect(providerName(googleUser("x".repeat(30)))).toHaveLength(20);
  });

  it("never falls back to the email", () => {
    expect(providerName(googleUser(undefined))).toBeUndefined();
    expect(providerName(googleUser("   "))).toBeUndefined();
    expect(providerName(null)).toBeUndefined();
  });
});
