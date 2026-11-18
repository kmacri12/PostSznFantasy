import { E2E_BUILD } from "./e2e";

/** One context for every cue: browsers allow audio only once the page has had a tap or key press. */
let context: AudioContext | null = null;
let unlockListening = false;

const unlock = () => {
  try {
    context ??= new AudioContext();
    void context.resume();
  } catch {
    // Audio is optional; missing support must not break the draft.
  }
};

/** Call once while the draft room is open; the first tap anywhere then allows the cues to play. */
export function unlockDraftAudio(): void {
  if (E2E_BUILD || unlockListening || typeof window === "undefined") return;
  unlockListening = true;
  for (const type of ["pointerdown", "keydown", "touchend"]) {
    window.addEventListener(type, unlock, { passive: true });
  }
}

interface Tone {
  frequency: number;
  /** Seconds after the cue starts. */
  at: number;
  length: number;
  volume: number;
  wave?: OscillatorType;
}

/** Plays only while the browser lets audio run; a cue is never queued behind a blocked context. */
function play(tones: Tone[]): void {
  if (E2E_BUILD) return;
  try {
    if (!context || context.state !== "running") return;
    const audio = context;
    const start = audio.currentTime;
    for (const tone of tones) {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = tone.wave ?? "sine";
      oscillator.frequency.value = tone.frequency;
      gain.gain.setValueAtTime(tone.volume, start + tone.at);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + tone.at + tone.length);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(start + tone.at);
      oscillator.stop(start + tone.at + tone.length);
    }
  } catch {
    // Audio is optional; autoplay policies or missing support must not break the draft.
  }
}

/** Soft single beep: my pick is next. */
export function playOnDeckCue(): void {
  play([{ frequency: 880, at: 0, length: 0.35, volume: 0.08 }]);
}

/** Loud rising three-note alert, clearly different from the on-deck beep: I'm on the clock. */
export function playOnTheClockCue(): void {
  play([
    { frequency: 660, at: 0, length: 0.22, volume: 0.35, wave: "triangle" },
    { frequency: 880, at: 0.24, length: 0.22, volume: 0.35, wave: "triangle" },
    { frequency: 1320, at: 0.48, length: 0.5, volume: 0.4, wave: "triangle" },
  ]);
}

/** One short tick per second in the last seconds of my pick. */
export function playCountdownTick(): void {
  play([{ frequency: 1000, at: 0, length: 0.12, volume: 0.15, wave: "square" }]);
}

export function vibrateOnTurn(): void {
  if (E2E_BUILD) return;
  // Chrome logs an intervention error for vibrating before the first tap on the page.
  if (navigator.userActivation?.hasBeenActive) navigator.vibrate?.([300, 120, 300, 120, 500]);
}
