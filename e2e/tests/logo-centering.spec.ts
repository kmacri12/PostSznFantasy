import { expect, test } from "@playwright/test";

/**
 * Horizontal position of a line's visible ink center, in CSS px: the text's left edge plus the
 * middle of the glyphs' real bounding box (canvas measureText), which excludes the trailing
 * letter-spacing and the side bearings that a layout rectangle includes.
 */
const inkCenter = (line: import("@playwright/test").Locator) =>
  line.evaluate(async (element) => {
    await document.fonts.ready;
    const style = getComputedStyle(element);
    const range = document.createRange();
    range.selectNodeContents(element);
    const text = element.textContent ?? "";
    const context = document.createElement("canvas").getContext("2d");
    if (!context) throw new Error("no canvas");
    context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    context.letterSpacing = style.letterSpacing;
    const box = context.measureText(text);
    const left = range.getBoundingClientRect().left;
    return left + (box.actualBoundingBoxRight - box.actualBoundingBoxLeft) / 2;
  });

for (const mode of ["dark", "light"]) {
  test(`FANTASY is centered under PostSzn in both lockups (${mode})`, async ({ page }) => {
    await page.addInitScript((m) => localStorage.setItem("postszn-theme", m), mode);
    await page.goto("/sign-in");
    // The sign-in page has the header's horizontal lockup and the card's stacked one.
    const names = page.locator('[data-logo-line="name"]');
    const fantasies = page.locator('[data-logo-line="fantasy"]');
    await expect(names).toHaveCount(2);
    for (const index of [0, 1]) {
      // The lockups come in document order, header (horizontal) then card (stacked).
      const name = await inkCenter(names.nth(index));
      // Same index into the same order, so it is the matching line of the same lockup.
      const fantasy = await inkCenter(fantasies.nth(index));
      expect(Math.abs(name - fantasy), `lockup ${index}: ${name} vs ${fantasy}`).toBeLessThan(0.5);
    }
  });
}
