import { afterEach, describe, expect, it, vi } from "vitest";
import { canShareInvite, shareInvite } from "./shareInvite";

afterEach(() => vi.unstubAllGlobals());

describe("shareInvite", () => {
  it("offers sharing only where the browser has a share sheet", () => {
    vi.stubGlobal("navigator", {});
    expect(canShareInvite()).toBe(false);
    vi.stubGlobal("navigator", { share: vi.fn() });
    expect(canShareInvite()).toBe(true);
  });
  it("shares the link and ignores a dismissed sheet", async () => {
    const share = vi.fn().mockRejectedValue(new DOMException("closed", "AbortError"));
    vi.stubGlobal("navigator", { share });
    await expect(shareInvite("https://x.test/join/ABCD2345")).resolves.toBeUndefined();
    expect(share).toHaveBeenCalledWith({
      title: "Join my league on PostSzn Fantasy",
      url: "https://x.test/join/ABCD2345",
    });
  });
});
