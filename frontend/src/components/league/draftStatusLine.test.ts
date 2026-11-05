import { describe, expect, it } from "vitest";
import { draftStatusLine } from "./draftStatusLine";

describe("draftStatusLine", () => {
  it("names each draft state", () => {
    const line = (draftStatus: Parameters<typeof draftStatusLine>[0]["draftStatus"]) =>
      draftStatusLine({ draftStatus, draftStartTime: null });
    expect(line("unscheduled")).toBe("Draft not scheduled");
    expect(line("scheduled")).toBe("Draft scheduled");
    expect(line("lobby")).toBe("Draft lobby open");
    expect(line("in_progress")).toBe("Draft under way");
    expect(line("paused")).toBe("Draft paused");
    expect(line("completed")).toBe("Draft complete");
  });

  it("gives the day and time once the draft has a start time", () => {
    const text = draftStatusLine({
      draftStatus: "scheduled",
      draftStartTime: "2030-01-12T19:00:00Z",
    });
    expect(text).toMatch(/^Draft \w+day, Jan 1[23]/);
  });
});
