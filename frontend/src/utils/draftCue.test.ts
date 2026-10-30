import { afterEach, describe, expect, it, vi } from "vitest";
import { vibrateOnTurn } from "./draftCue";

describe("vibrateOnTurn", () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, "vibrate");
    Reflect.deleteProperty(navigator, "userActivation");
  });

  const stubVibrate = (hasBeenActive: boolean) => {
    const vibrate = vi.fn();
    Object.defineProperty(navigator, "vibrate", { value: vibrate, configurable: true });
    Object.defineProperty(navigator, "userActivation", {
      value: { hasBeenActive },
      configurable: true,
    });
    return vibrate;
  };

  it("vibrates where supported", () => {
    const vibrate = stubVibrate(true);
    vibrateOnTurn();
    expect(vibrate).toHaveBeenCalled();
  });

  it("stays quiet until the user has tapped the page", () => {
    const vibrate = stubVibrate(false);
    vibrateOnTurn();
    expect(vibrate).not.toHaveBeenCalled();
  });

  it("does nothing where unsupported", () => {
    expect(() => vibrateOnTurn()).not.toThrow();
  });
});
