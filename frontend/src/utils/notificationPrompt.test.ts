import { beforeEach, describe, expect, it } from "vitest";
import {
  localDay,
  MAX_PROMPTS,
  mayPrompt,
  PROMPT_STORAGE_KEY,
  promptRouteAllowed,
  readPromptRecord,
  recordPromptAccepted,
  recordPromptShown,
} from "./notificationPrompt";

const day = (n: number) => localDay(new Date(2026, 11, n));

beforeEach(() => localStorage.clear());

describe("the two-prompt cap", () => {
  it("shows the first prompt on a fresh device", () => {
    expect(mayPrompt(readPromptRecord(), day(1))).toBe(true);
    expect(recordPromptShown(day(1))).toBe(true);
  });

  it("holds the second prompt until a different day", () => {
    expect(recordPromptShown(day(1))).toBe(true);
    expect(recordPromptShown(day(1))).toBe(false);
    expect(recordPromptShown(day(2))).toBe(true);
  });

  it("never shows a third prompt, however many days pass or triggers fire", () => {
    let shown = 0;
    for (let d = 1; d <= 28; d++) {
      for (let trigger = 0; trigger < 5; trigger++) {
        if (recordPromptShown(day(d))) shown++;
      }
    }
    expect(shown).toBe(MAX_PROMPTS);
    expect(mayPrompt(readPromptRecord(), day(29))).toBe(false);
  });

  it("stops for good once they turned notifications on from a prompt", () => {
    recordPromptShown(day(1));
    recordPromptAccepted();
    expect(recordPromptShown(day(2))).toBe(false);
  });
});

describe("storage that cannot be trusted shows nothing", () => {
  it("treats a damaged record as already prompted out", () => {
    localStorage.setItem(PROMPT_STORAGE_KEY, "{not json");
    expect(readPromptRecord()).toBeNull();
    expect(recordPromptShown(day(1))).toBe(false);
  });

  it("treats a record of the wrong shape the same way", () => {
    localStorage.setItem(PROMPT_STORAGE_KEY, JSON.stringify({ shown: "one" }));
    expect(recordPromptShown(day(1))).toBe(false);
  });

  it("does not show when the count cannot be saved", () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error("quota");
    };
    try {
      expect(recordPromptShown(day(1))).toBe(false);
    } finally {
      Storage.prototype.setItem = original;
    }
  });

  it("does not show when storage is unavailable", () => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = () => {
      throw new Error("blocked");
    };
    try {
      expect(readPromptRecord()).toBeNull();
      expect(recordPromptShown(day(1))).toBe(false);
    } finally {
      Storage.prototype.getItem = original;
    }
  });
});

describe("where the prompt may appear", () => {
  it.each([
    "/leagues/3/draft",
    "/leagues/3/draft/board",
    "/leagues/3/seasons/2025/draft",
    "/sign-in",
    "/join/ABC123",
    "/create-league",
  ])("not on %s", (path) => {
    expect(promptRouteAllowed(path)).toBe(false);
  });

  it.each(["/", "/leagues/3", "/leagues/3/feed", "/leagues/3/more", "/leagues/3/teams/5"])(
    "on %s",
    (path) => {
      expect(promptRouteAllowed(path)).toBe(true);
    },
  );
});
