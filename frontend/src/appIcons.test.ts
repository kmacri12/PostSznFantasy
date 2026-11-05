import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { palettes } from "./theme";

const paeth = (a: number, b: number, c: number) => {
  const p = a + b - c;
  const [pa, pb, pc] = [Math.abs(p - a), Math.abs(p - b), Math.abs(p - c)];
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

/** Decodes an 8-bit, non-interlaced RGB or RGBA PNG into a pixel reader. */
const decode = (file: string) => {
  const png = readFileSync(`public/icons/${file}`);
  const width = png.readUInt32BE(16);
  const channels = png[25] === 6 ? 4 : 3;
  const chunks: Buffer[] = [];
  for (let at = 8; at < png.length; ) {
    const length = png.readUInt32BE(at);
    if (png.toString("ascii", at + 4, at + 8) === "IDAT") {
      chunks.push(png.subarray(at + 8, at + 8 + length));
    }
    at += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(chunks));
  const stride = width * channels;
  const rows: Buffer[] = [];
  for (let y = 0; y < width; y++) {
    const filter = raw[y * (stride + 1)] ?? 0;
    const line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    const above = (y > 0 ? rows[y - 1] : undefined) ?? Buffer.alloc(stride);
    for (let i = 0; i < stride; i++) {
      const left = (i >= channels ? line[i - channels] : 0) ?? 0;
      const up = above[i] ?? 0;
      const upLeft = (i >= channels ? above[i - channels] : 0) ?? 0;
      const add = [0, left, up, (left + up) >> 1, paeth(left, up, upLeft)][filter] ?? 0;
      line[i] = ((line[i] ?? 0) + add) & 255;
    }
    rows.push(line);
  }
  return {
    width,
    hex: (x: number, y: number) =>
      `#${[0, 1, 2].map((c) => (rows[y]?.[x * channels + c] ?? 0).toString(16).padStart(2, "0")).join("")}`,
  };
};

const FILL = palettes.dark.accentFill;
const INK = palettes.dark.accentInk;

// The app icon is always the sky-blue tile with the dark bracket, never bare lines on a theme
// background (docs/ui/README.md, Logo).
describe.each([
  "icon-180.png",
  "icon-192.png",
  "icon-512.png",
  "icon-maskable-512.png",
  "favicon-32.png",
])("%s", (file) => {
  const icon = decode(file);

  it("is the sky-blue tile", () => {
    expect(icon.hex(Math.round(icon.width * 0.5), Math.round(icon.width * 0.06))).toBe(FILL);
    expect(icon.hex(Math.round(icon.width * 0.06), Math.round(icon.width * 0.5))).toBe(FILL);
  });

  it("carries the dark bracket's joining bar in the middle", () => {
    expect(icon.hex(Math.round(icon.width * 0.5), Math.round(icon.width * 0.5))).toBe(INK);
  });
});

describe("full-bleed icons", () => {
  it.each(["icon-180.png", "icon-maskable-512.png"])("%s is blue to the corner", (file) => {
    expect(decode(file).hex(0, 0)).toBe(FILL);
  });
});
