import { describe, expect, it } from "vitest";
import type { DraftPick, PickSource } from "../../api/types";
import { pickSentence, pickToast, sourceDetail, sourcesOnBoard } from "./pickSource";

const pick = (source: PickSource, teamId = 10): DraftPick =>
  ({ teamId, playerName: "Josh Allen", numberPickOverall: 3, source }) as DraftPick;

describe("pick source wording", () => {
  it("tells a commissioner's auto-pick now apart from a timer auto pick", () => {
    expect(sourceDetail("timer")).toBe("Auto-picked: time ran out");
    expect(sourceDetail("commissioner_auto")).toBe(
      "Commissioner action · auto-picked (Auto-pick now)",
    );
    expect(pickSentence(pick("timer"), "Alpha")).toBe(
      "Pick 3: time ran out, Josh Allen was auto-picked for Alpha",
    );
    expect(pickSentence(pick("commissioner_auto"), "Alpha")).toBe(
      "Pick 3: the commissioner auto-picked Josh Allen for Alpha",
    );
    expect(pickSentence(pick("manager"), "Alpha")).toBe("Pick 3: Alpha took Josh Allen");
  });

  it("toasts the drafter for picks made for them and everyone for the commissioner's", () => {
    expect(pickToast(pick("timer"), 10, "Alpha")).toBe(
      "Time ran out: Josh Allen was auto-picked for you",
    );
    expect(pickToast(pick("timer"), 20, "Alpha")).toBeNull();
    expect(pickToast(pick("no_owner"), 20, "Alpha")).toBeNull();
    expect(pickToast(pick("manager"), 10, "Alpha")).toBeNull();
    expect(pickToast(pick("commissioner_assigned"), 20, "Alpha")).toBe(
      "The commissioner picked Josh Allen for Alpha",
    );
  });

  it("lists each badged source once, in legend order", () => {
    const picks = [pick("commissioner_assigned"), pick("manager"), pick("timer"), pick("timer")];
    expect(sourcesOnBoard(picks)).toEqual(["timer", "commissioner_assigned"]);
  });
});
