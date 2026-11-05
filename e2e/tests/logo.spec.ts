import { expect, test } from "@playwright/test";

test("the landing page shows the lockup in the bar, the bare mark in the hero and the tile favicon", async ({
  page,
}) => {
  await page.goto("/");
  // The bar's lockup, then the hero's mark (one per breakpoint, only one is displayed).
  await expect(
    page.getByRole("img", { name: "PostSzn Fantasy" }).filter({ visible: true }),
  ).toHaveCount(2);
  await expect(page.getByText("FANTASY", { exact: true })).toHaveCount(1);
  await expect(page.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveAttribute(
    "href",
    "/favicon.svg",
  );
});
