import { describe, expect, it } from "vitest";
import { addImages, attachmentSummary, MAX_IMAGE_BYTES, MAX_IMAGES } from "./images";

const MB = 1024 * 1024;

const file = (name: string, bytes: number, type = "image/png"): File => {
  const made = new File([], name, { type });
  Object.defineProperty(made, "size", { value: bytes });
  return made;
};

describe("addImages", () => {
  it("attaches images in the order picked", () => {
    const result = addImages([], [file("a.png", MB), file("b.png", MB)]);
    expect(result.files.map((item) => item.name)).toEqual(["a.png", "b.png"]);
    expect(result.problems).toEqual([]);
  });

  it("refuses an image over the per-image limit with its size", () => {
    const result = addImages([], [file("big.png", 7.2 * MB)]);
    expect(result.files).toEqual([]);
    expect(result.problems).toEqual(["That image is 7.2 MB. The limit is 5.0 MB per image."]);
  });

  it("accepts an image exactly at the limit", () => {
    expect(addImages([], [file("edge.png", MAX_IMAGE_BYTES)]).files).toHaveLength(1);
  });

  it("refuses an image that would push the total over 15 MB but keeps the earlier ones", () => {
    const current = [file("a.png", 5 * MB), file("b.png", 5 * MB), file("c.png", 4 * MB)];
    const result = addImages(current, [file("d.png", 3 * MB)]);
    expect(result.files).toHaveLength(3);
    expect(result.problems[0]).toContain("17.0 MB");
    expect(result.problems[0]).toContain("15.0 MB in total");
  });

  it("refuses a sixth image", () => {
    const current = Array.from({ length: MAX_IMAGES }, (_, i) => file(`${i}.png`, MB));
    const result = addImages(current, [file("six.png", MB)]);
    expect(result.files).toHaveLength(MAX_IMAGES);
    expect(result.problems).toEqual([`You can attach up to ${MAX_IMAGES} images.`]);
  });

  it("refuses non-images but takes HEIC photos that report no type", () => {
    const result = addImages(
      [],
      [file("notes.pdf", MB, "application/pdf"), file("IMG.HEIC", MB, "")],
    );
    expect(result.files.map((item) => item.name)).toEqual(["IMG.HEIC"]);
    expect(result.problems[0]).toContain("isn't an image");
  });

  it("reports one message per reason, not per file", () => {
    const result = addImages([], [file("a.pdf", 1, "text/plain"), file("b.pdf", 1, "text/plain")]);
    expect(result.problems).toHaveLength(2);
    const twoBig = addImages([], [file("a.png", 6 * MB), file("b.png", 6 * MB)]);
    expect(twoBig.problems).toHaveLength(1);
  });
});

describe("attachmentSummary", () => {
  it("shows the running count and size", () => {
    const files = [file("a.png", 3 * MB), file("b.png", 4 * MB), file("c.png", 2.1 * MB)];
    expect(attachmentSummary(files)).toBe("3 of 5 images, 9.1 MB of 15.0 MB");
  });
});
