import { afterEach, describe, expect, it, vi } from "vitest";
import { vibrateOnTurn } from "./draftCue";

describe("vibrateOnTurn", () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, "vibrate");
  });

  it("vibrates where supported", () => {
    const vibrate = vi.fn();
    Object.defineProperty(navigator, "vibrate", { value: vibrate, configurable: true });
    vibrateOnTurn();
    expect(vibrate).toHaveBeenCalled();
  });

  it("does nothing where unsupported", () => {
    expect(() => vibrateOnTurn()).not.toThrow();
  });
});
