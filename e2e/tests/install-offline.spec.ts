import { expect, test } from "@playwright/test";
import { Api, seasonUrl, unique } from "../support/api";
import { signInAs } from "../support/auth";

// #400. The e2e build registers the service worker with ?nocache, so these cover the page side:
// the install guide, the offline banner, the deploy-skew prompt and the Home Screen shortcuts.
test.describe("install, offline and updates", () => {
  test("More opens the install guide with the iPhone steps", async ({ page, context, request }) => {
    const host = new Api(request, unique("install"));
    await host.signUp("install");
    const league = await host.createLeague(unique("Install League"));
    await signInAs(context, host.uid);

    await page.goto(seasonUrl(league, "/more"));
    await page.getByRole("button", { name: /Install the app/ }).click();
    const sheet = page.getByRole("dialog", { name: "Install PostSzn" });
    await expect(sheet.getByText(/Add to Home Screen/)).toBeVisible();
    await sheet.getByRole("button", { name: "Not now" }).click();
    await expect(sheet).toHaveCount(0);
  });

  test("going offline shows the banner and refuses changes with a reason", async ({
    page,
    context,
    request,
  }) => {
    const host = new Api(request, unique("offline"));
    await host.signUp("offline");
    const league = await host.createLeague(unique("Offline League"));
    await signInAs(context, host.uid);

    await page.goto(seasonUrl(league));
    await expect(page.getByRole("link", { name: "League", exact: true })).toBeVisible();

    await context.setOffline(true);
    const banner = page.getByRole("status").filter({ hasText: "You're offline." });
    await expect(banner).toContainText("Changes are turned off until you're back.");

    await context.setOffline(false);
    await expect(banner).toHaveCount(0);
  });

  test("a deploy while the app is open offers a refresh", async ({ page, context, request }) => {
    const host = new Api(request, unique("skew"));
    await host.signUp("skew");
    const league = await host.createLeague(unique("Skew League"));
    await signInAs(context, host.uid);
    await page.route("**/version.json", (route) =>
      route.fulfill({ json: { builtAt: 9_999_999_999 } }),
    );

    await page.goto(seasonUrl(league));
    await expect(page.getByText("Update available, tap to refresh")).toBeVisible();
    await expect(page.getByRole("button", { name: "Refresh", exact: true })).toBeVisible();
    await page.unrouteAll({ behavior: "wait" });
  });

  test("the Draft shortcut opens the member's league draft", async ({ page, context, request }) => {
    const host = new Api(request, unique("shortcut"));
    await host.signUp("shortcut");
    const league = await host.createLeague(unique("Shortcut League"));
    await signInAs(context, host.uid);

    await page.goto("/?shortcut=draft");
    await expect(page).toHaveURL(seasonUrl(league, "/draft"));
  });
});
