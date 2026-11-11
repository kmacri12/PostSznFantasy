import { afterEach, describe, expect, it, vi } from "vitest";
import { shareImage } from "./shareImage";

afterEach(() => vi.unstubAllGlobals());

const blob = new Blob(["x"], { type: "image/png" });

describe("shareImage", () => {
  it("shares the file where the browser can", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { canShare: () => true, share });
    await expect(shareImage(blob, "card.png", "Title")).resolves.toBe("shared");
    expect(share.mock.calls[0]?.[0].files[0].name).toBe("card.png");
  });
  it("treats a closed sheet as done, not as a download", async () => {
    const share = vi.fn().mockRejectedValue(new DOMException("closed", "AbortError"));
    vi.stubGlobal("navigator", { canShare: () => true, share });
    await expect(shareImage(blob, "card.png", "T")).resolves.toBe("cancelled");
  });
  it("downloads when files cannot be shared", async () => {
    vi.stubGlobal("navigator", {});
    URL.createObjectURL = vi.fn(() => "blob:x");
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    await expect(shareImage(blob, "card.png", "T")).resolves.toBe("downloaded");
    expect(click).toHaveBeenCalled();
  });
});
