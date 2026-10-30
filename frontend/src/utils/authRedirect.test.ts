import { describe, expect, it } from "vitest";
import { authCallbackUrl, parseAuthCallbackError, safeNextPath, signInPath } from "./authRedirect";

describe("safeNextPath", () => {
  it("keeps same-origin paths with query and hash", () => {
    expect(safeNextPath("/join/ABC123")).toBe("/join/ABC123");
    expect(safeNextPath("/league/4/draft?x=1#top")).toBe("/league/4/draft?x=1#top");
  });

  it.each([
    null,
    undefined,
    "",
    "join/ABC",
    "//evil.com",
    "/\\evil.com",
    "https://evil.com",
    "/sign-in",
  ])("falls back to / for %s", (raw) => {
    expect(safeNextPath(raw)).toBe("/");
  });

  it("does not bounce back to the sign-in page", () => {
    expect(safeNextPath("/sign-in?next=/x")).toBe("/");
  });
});

describe("signInPath / authCallbackUrl", () => {
  it("carries the destination in the query string", () => {
    expect(signInPath("/join/ABC")).toBe("/sign-in?next=%2Fjoin%2FABC");
  });

  it("omits next for the default destination", () => {
    expect(signInPath("/")).toBe("/sign-in");
  });

  it("builds an absolute callback url for Supabase", () => {
    expect(authCallbackUrl("https://app.test", "/join/ABC")).toBe(
      "https://app.test/sign-in?next=%2Fjoin%2FABC",
    );
  });
});

describe("parseAuthCallbackError", () => {
  it("reads an expired magic link from the hash", () => {
    const parsed = parseAuthCallbackError(
      "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired",
    );
    expect(parsed).toEqual({ code: "otp_expired", message: expect.stringMatching(/expired/i) });
  });

  it("reads errors from the query string too", () => {
    expect(parseAuthCallbackError("?error=access_denied&error_code=otp_expired")?.code).toBe(
      "otp_expired",
    );
  });

  it("returns null when the url carries no error", () => {
    expect(parseAuthCallbackError("#access_token=abc&type=magiclink")).toBeNull();
    expect(parseAuthCallbackError("")).toBeNull();
  });
});
