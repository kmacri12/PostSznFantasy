import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { palettes } from "./theme";
import { THEME_STORAGE_KEY } from "./utils/themeMode";

const html = readFileSync("index.html", "utf8");
const manifest = (file: string) => JSON.parse(readFileSync(`public/${file}`, "utf8"));

// The inline script and styles run before any module, so they cannot import the palette.
describe("index.html and the manifests follow the palette", () => {
  it("applies the saved light mode before first paint", () => {
    expect(html).toContain(`localStorage.getItem("${THEME_STORAGE_KEY}") !== "light"`);
    expect(html).toContain(`setAttribute("content", "${palettes.light.bg}")`);
    expect(html).toContain("/manifest-light.webmanifest");
    expect(html).toContain(`content="${palettes.dark.bg}"`);
  });

  it("paints each mode's page background", () => {
    expect(html).toMatch(new RegExp(`transparent\\), ${palettes.dark.bg};`));
    expect(html).toMatch(new RegExp(`transparent\\), ${palettes.light.bg};`));
  });

  it("gives each mode its own manifest colors", () => {
    for (const [file, mode] of [
      ["manifest.webmanifest", "dark"],
      ["manifest-light.webmanifest", "light"],
    ] as const) {
      expect(manifest(file).theme_color).toBe(palettes[mode].bg);
      expect(manifest(file).background_color).toBe(palettes[mode].bg);
    }
  });
});
