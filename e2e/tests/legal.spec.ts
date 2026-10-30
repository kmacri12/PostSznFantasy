import { expect, test } from "@playwright/test";

test.describe("legal pages, signed out", () => {
  test("the landing footer links to privacy and terms", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Privacy", exact: true }).click();
    await expect(page).toHaveURL(/\/privacy$/);
    await expect(page.getByRole("heading", { level: 1, name: "Privacy Policy" })).toBeVisible();
    await expect(page.getByText(/do not sell your data/i)).toBeVisible();

    await page.goto("/");
    await page.getByRole("link", { name: "Terms", exact: true }).click();
    await expect(page).toHaveURL(/\/terms$/);
    await expect(page.getByRole("heading", { level: 1, name: "Terms of Service" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /not gambling/i })).toBeVisible();
  });

  test("the sign-in page links to both and neither page scrolls sideways", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page.getByRole("link", { name: "Terms", exact: true })).toHaveAttribute(
      "href",
      "/terms",
    );
    await expect(page.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute(
      "href",
      "/privacy",
    );
    for (const path of ["/privacy", "/terms"]) {
      await page.goto(path);
      await expect(page.getByRole("banner")).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${path} scrolls sideways`).toBeLessThanOrEqual(0);
    }
  });
});
