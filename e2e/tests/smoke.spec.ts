import { expect, test } from "@playwright/test";
import { Api, unique } from "../support/api";
import { signInAs } from "../support/auth";

test("the landing page renders without horizontal scroll", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("banner")).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("an unknown route shows the not-found page", async ({ page }) => {
  await page.goto("/no-such-page");
  await expect(page.getByRole("heading", { name: /page not found/i })).toBeVisible();
});

test.describe("signed in", () => {
  test("league pages fit the viewport and the players table renders", async ({
    page,
    context,
    request,
  }, testInfo) => {
    const host = new Api(request, unique("smoke"));
    await host.signUp("smoke");
    const leagueId = await host.createLeague(unique("Smoke League"));
    await signInAs(context, host.uid);
    const teamId = (await host.get<{ myTeamId: number }>(`/api/leagues/${leagueId}`)).myTeamId;

    const pages = [
      "/",
      `/league/${leagueId}`,
      `/league/${leagueId}/draft`,
      `/team/${teamId}`,
      `/settings?leagueId=${leagueId}`,
      `/players?leagueId=${leagueId}`,
    ];
    for (const url of pages) {
      await page.goto(url);
      await expect(page.getByRole("banner")).toBeVisible();
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${url} scrolls sideways by ${overflow}px`).toBeLessThanOrEqual(0);
    }

    await page.goto("/players");
    if (testInfo.project.name === "desktop") {
      await expect(page.getByRole("table")).toBeVisible();
    } else {
      await expect(page.getByRole("list", { name: "Players" })).toBeVisible();
    }
  });
});
