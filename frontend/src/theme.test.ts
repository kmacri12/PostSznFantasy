import { describe, expect, it } from "vitest";
import { modeVariables, palettes, type ThemeMode, tokens } from "./theme";

const luminance = (hex: string): number => {
  const linear = (start: number): number => {
    const c = Number.parseInt(hex.slice(start, start + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(1) + 0.7152 * linear(3) + 0.0722 * linear(5);
};

const contrast = (a: string, b: string): number => {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

type Key = keyof typeof palettes.dark;

// [foreground, background, minimum]: 4.5 for body text, 3 for large text and UI components.
const PAIRS: [Key, Key, number][] = [
  ["accentInk", "accentFill", 4.5],
  ["accent", "bg", 4.5],
  ["accent", "surface", 4.5],
  ["accent", "accentSurface", 4.5],
  ["accentSoft", "accentSurface", 4.5],
  ["accentSoft", "bg", 4.5],
  ["text", "bg", 4.5],
  ["text", "surface", 4.5],
  ["text", "accentSurface", 4.5],
  ["textSoft", "surface", 4.5],
  ["muted", "bg", 4.5],
  ["muted", "surface", 4.5],
  ["muted", "surfaceRaised", 4.5],
  ["live", "bg", 4.5],
  ["live", "surface", 4.5],
  ["liveSoft", "bg", 4.5],
  ["green", "surface", 3],
  ["red", "bg", 4.5],
  ["red", "surface", 4.5],
  ["redSoft", "bg", 4.5],
  ["warning", "bg", 4.5],
  ["warning", "surface", 4.5],
  ["gold", "bg", 4.5],
  ["gold", "surface", 4.5],
  ["redSoft", "dangerSurface", 4.5],
  ["dangerMuted", "dangerSurface", 4.5],
  ["text", "dangerHeader", 4.5],
  ["inputBorder", "bg", 3],
  ["inputBorder", "surface", 3],
  ["accent", "bg", 3],
  ["text", "posQB", 4.5],
  ["text", "posRB", 4.5],
  ["text", "posWR", 4.5],
  ["text", "posTE", 4.5],
  ["text", "posK", 4.5],
  ["text", "posDST", 4.5],
  ["textSoft", "posQB", 4.5],
  ["textSoft", "posRB", 4.5],
  ["textSoft", "posWR", 4.5],
  ["textSoft", "posTE", 4.5],
  ["textSoft", "posK", 4.5],
  ["textSoft", "posDST", 4.5],
  ["accentInk", "accentFill", 4.5],
];

describe.each(["dark", "light"] as ThemeMode[])("%s palette contrast (WCAG AA)", (mode) => {
  const palette = palettes[mode];
  it.each(PAIRS)("%s on %s is at least %f:1", (foreground, background, minimum) => {
    expect(contrast(palette[foreground], palette[background])).toBeGreaterThanOrEqual(minimum);
  });
});

describe("token variables", () => {
  it("defines every token for both modes", () => {
    expect(Object.keys(palettes.light).sort()).toEqual(Object.keys(palettes.dark).sort());
    for (const key of Object.keys(palettes.dark)) {
      expect(tokens[key as Key]).toBe(`var(--ps-${key})`);
      expect(modeVariables).toContain(`--ps-${key}: ${palettes.dark[key as Key]};`);
      expect(modeVariables).toContain(`--ps-${key}: ${palettes.light[key as Key]};`);
    }
  });

  it("keeps the sky-blue fill identical in both modes", () => {
    expect(palettes.light.accentFill).toBe(palettes.dark.accentFill);
  });
});
