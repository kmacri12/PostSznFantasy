import { describe, expect, it } from "vitest";
import { pageTitle } from "./pageTitle";

describe("pageTitle", () => {
  it("names the page and the league", () => {
    expect(pageTitle("/leagues/3", "Fantasy Four")).toBe(
      "Standings · Fantasy Four · PostSzn Fantasy",
    );
    expect(pageTitle("/leagues/3/draft/board", "Fantasy Four")).toBe(
      "Draft board · Fantasy Four · PostSzn Fantasy",
    );
    expect(pageTitle("/leagues/3/seasons/2025/teams/9", "Fantasy Four")).toBe(
      "Team · Fantasy Four · PostSzn Fantasy",
    );
  });
  it("falls back to the brand without a league name", () => {
    expect(pageTitle("/leagues/3/feed")).toBe("Feed · PostSzn Fantasy");
    expect(pageTitle("/")).toBe("PostSzn Fantasy");
  });
  it("titles the pages outside a league", () => {
    expect(pageTitle("/how-to-play")).toBe("How to play · PostSzn Fantasy");
    expect(pageTitle("/join/ABC123")).toBe("Join a league · PostSzn Fantasy");
  });
});
