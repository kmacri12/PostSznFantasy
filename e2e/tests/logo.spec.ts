import { expect, test } from "@playwright/test";

test("the landing page shows the lockup, the stacked logo and the tile favicon", async ({
  page,
}) => {
  await page.goto("/");
  // The header lockup and the hero's stacked logo both carry the product name.
  await expect(page.getByRole("img", { name: "PostSzn Fantasy" })).toHaveCount(2);
  await expect(page.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveAttribute(
    "href",
    "/favicon.svg",
  );
  await expect(page.getByText("FANTASY", { exact: true })).toHaveCount(2);
});
