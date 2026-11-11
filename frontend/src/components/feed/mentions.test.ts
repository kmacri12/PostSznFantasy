import { describe, expect, it } from "vitest";
import type { MemberSummary } from "../../api/types";
import {
  insertMention,
  mentionQuery,
  segmentBody,
  stillMentioned,
  suggestMembers,
} from "./mentions";

const member = (userId: number, username: string): MemberSummary => ({
  userId,
  username,
  role: "member",
  teamId: null,
  teamName: null,
});

describe("mentionQuery", () => {
  it("finds the @ being typed before the caret", () => {
    expect(mentionQuery("hey @da", 7)).toEqual({ start: 4, query: "da" });
    expect(mentionQuery("@", 1)).toEqual({ start: 0, query: "" });
  });

  it("ignores an @ inside a word, one already finished or one after the caret", () => {
    expect(mentionQuery("mail me at a@b", 14)).toBeNull();
    expect(mentionQuery("hey @dave and", 13)).toBeNull();
    expect(mentionQuery("hey @dave", 3)).toBeNull();
  });
});

describe("suggestMembers", () => {
  const members = [member(1, "Kyle"), member(2, "Dave"), member(3, "Pat"), member(4, "Eddave")];

  it("lists names that start with the query first, then those that contain it, never yourself", () => {
    expect(suggestMembers(members, "dav", 1).map((m) => m.username)).toEqual(["Dave", "Eddave"]);
    expect(suggestMembers(members, "", 1).map((m) => m.username)).toEqual([
      "Dave",
      "Pat",
      "Eddave",
    ]);
  });

  it("caps the list", () => {
    const many = Array.from({ length: 9 }, (_, i) => member(i + 10, `Player${i}`));
    expect(suggestMembers(many, "pl", null)).toHaveLength(5);
  });
});

describe("insertMention", () => {
  it("swaps the typed query for the full name and a space, and moves the caret after it", () => {
    const text = "hey @da and more";
    const caret = 7;
    const query = mentionQuery(text, caret);
    if (!query) throw new Error("expected a query");
    expect(insertMention(text, caret, query, "Dave")).toEqual({
      text: "hey @Dave  and more",
      caret: 10,
    });
  });
});

describe("stillMentioned", () => {
  it("keeps only the picked members whose name is still in the text", () => {
    const picked = new Map([
      [2, "Dave"],
      [3, "Pat"],
    ]);
    expect(stillMentioned("thanks @dave", picked)).toEqual([2]);
    expect(stillMentioned("nobody", picked)).toEqual([]);
  });
});

describe("segmentBody", () => {
  it("returns the text whole without mentions", () => {
    expect(segmentBody("hello", [])).toEqual([{ text: "hello", mention: false }]);
  });

  it("sets tagged names apart, longest name first, and leaves other @ text plain", () => {
    const mentions = [
      { userId: 2, name: "Dave" },
      { userId: 5, name: "Dave Smith" },
    ];
    expect(segmentBody("@Dave Smith and @Dave, not @Pat.", mentions)).toEqual([
      { text: "@Dave Smith", mention: true },
      { text: " and ", mention: false },
      { text: "@Dave", mention: true },
      { text: ", not @Pat.", mention: false },
    ]);
  });

  it("treats regex characters in a name literally", () => {
    expect(segmentBody("hi @a.b!", [{ userId: 1, name: "a.b" }])).toEqual([
      { text: "hi ", mention: false },
      { text: "@a.b", mention: true },
      { text: "!", mention: false },
    ]);
  });
});
