import { afterEach, describe, expect, it, vi } from "vitest";
import { playOnTheClockCue, unlockDraftAudio, vibrateOnTurn } from "./draftCue";

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

describe("audio cues", () => {
  const oscillators: { frequency: { value: number } }[] = [];
  let state = "suspended";

  class FakeAudioContext {
    currentTime = 0;
    destination = {};
    get state() {
      return state;
    }
    resume() {
      state = "running";
      return Promise.resolve();
    }
    createOscillator() {
      const node = {
        frequency: { value: 0 },
        type: "sine",
        connect: (next: unknown) => next,
        start: vi.fn(),
        stop: vi.fn(),
      };
      oscillators.push(node);
      return node;
    }
    createGain() {
      const node = {
        gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        connect: (next: unknown) => next,
      };
      return node;
    }
  }

  afterEach(() => vi.unstubAllGlobals());

  it("stays silent until a tap unlocks audio, then plays the three-note alert", () => {
    vi.stubGlobal("AudioContext", FakeAudioContext);
    unlockDraftAudio();
    playOnTheClockCue();
    expect(oscillators).toHaveLength(0);
    window.dispatchEvent(new Event("pointerdown"));
    playOnTheClockCue();
    expect(oscillators.map((node) => node.frequency.value)).toEqual([660, 880, 1320]);
  });
});
