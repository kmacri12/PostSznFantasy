import { expect, test } from "@playwright/test";
import { Api, seasonUrl, unique } from "../support/api";
import { signInAs } from "../support/auth";

test("the theme switches in profile settings at once and survives a reload", async ({
  page,
  context,
  request,
}) => {
  const host = new Api(request, unique("theme"));
  await host.signUp("theme");
  const league = await host.createLeague(unique("Theme League"));
  await signInAs(context, host.uid);

  const openProfile = () => page.getByRole("button", { name: "Profile settings" }).click();
  await page.goto(seasonUrl(league));
  await openProfile();
  const html = page.locator("html");
  const dark = page.getByRole("button", { name: "Dark", exact: true });
  const light = page.getByRole("button", { name: "Light", exact: true });
  await expect(dark).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(18, 20, 22)");

  await light.click();
  await expect(html).toHaveAttribute("data-theme", "light");
  await expect(light).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#ffffff");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    "/manifest-light.webmanifest",
  );

  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "light");
  await openProfile();
  await expect(page.getByRole("button", { name: "Light", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await expect(html).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(18, 20, 22)");
});

test("a saved light choice is applied to the landing page on load", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("postszn-theme", "light"));
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(255, 255, 255)");
});
