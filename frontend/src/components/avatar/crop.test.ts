import { describe, expect, it } from "vitest";
import { imageProblem, panView, sourceRect } from "./crop";

const file = (name: string, type: string, size: number): File => {
  const made = new File([], name, { type });
  Object.defineProperty(made, "size", { value: size });
  return made;
};

describe("sourceRect", () => {
  it("shows the short side of a landscape image at zoom 1, centered", () => {
    expect(sourceRect(1000, 500, { zoom: 1, centerX: 0.5, centerY: 0.5 })).toEqual({
      x: 250,
      y: 0,
      size: 500,
    });
  });

  it("shrinks the square as you zoom in", () => {
    expect(sourceRect(1000, 1000, { zoom: 2, centerX: 0.5, centerY: 0.5 }).size).toBe(500);
  });

  it("never leaves the image, however far the center is pushed", () => {
    const rect = sourceRect(1000, 1000, { zoom: 2, centerX: 0.99, centerY: 0.01 });
    expect(rect).toEqual({ x: 500, y: 0, size: 500 });
  });
});

describe("panView", () => {
  it("dragging right shows more of the left of the image", () => {
    const start = { zoom: 2, centerX: 0.5, centerY: 0.5 };
    const moved = panView(1000, 1000, start, 60, 0, 240);
    expect(moved.centerX).toBeLessThan(0.5);
    expect(moved.centerY).toBe(0.5);
  });

  it("stops at the edge", () => {
    const start = { zoom: 2, centerX: 0.5, centerY: 0.5 };
    const moved = panView(1000, 1000, start, 10_000, 10_000, 240);
    expect(sourceRect(1000, 1000, moved)).toEqual({ x: 0, y: 0, size: 500 });
  });
});

describe("imageProblem", () => {
  it("accepts an image, including a HEIC photo without a type", () => {
    expect(imageProblem(file("a.png", "image/png", 1000))).toBeNull();
    expect(imageProblem(file("IMG.HEIC", "", 1000))).toBeNull();
  });

  it("refuses a non-image and an image over 5 MB with its size", () => {
    expect(imageProblem(file("a.pdf", "application/pdf", 10))).toContain("isn't an image");
    expect(imageProblem(file("big.png", "image/png", 7.2 * 1024 * 1024))).toBe(
      "That image is 7.2 MB. The limit is 5.0 MB.",
    );
  });
});
