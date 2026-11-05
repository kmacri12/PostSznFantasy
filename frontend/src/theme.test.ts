import { describe, expect, it } from "vitest";
import { tokens } from "./theme";

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

describe("palette contrast (WCAG AA)", () => {
  it.each([
    ["text on accent", tokens.accentInk, tokens.accent, 4.5],
    ["accent on the page", tokens.accent, tokens.bg, 4.5],
    ["accent on a card", tokens.accent, tokens.surface, 4.5],
    ["accent on its tint", tokens.accent, tokens.accentSurface, 4.5],
    ["soft accent on its tint", tokens.accentSoft, tokens.accentSurface, 4.5],
    ["body text on a card", tokens.text, tokens.surface, 4.5],
    ["muted text on a card", tokens.muted, tokens.surface, 4.5],
    ["muted text on a raised surface", tokens.muted, tokens.surfaceRaised, 4.5],
    ["live green on a card", tokens.live, tokens.surface, 4.5],
    ["input border on a card", tokens.inputBorder, tokens.surface, 3],
  ])("%s", (_name, foreground, background, minimum) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(minimum);
  });
});
