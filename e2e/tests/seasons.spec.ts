import { expect, test } from "@playwright/test";
import { Api, seasonUrl, unique } from "../support/api";
import { signInAs } from "../support/auth";

test.describe("season routes", () => {
  test("a league opens on its current season and an unknown year is not found", async ({
    page,
    context,
    request,
  }) => {
    const host = new Api(request, unique("seasons"));
    await host.signUp("seasons");
    const league = await host.createLeague(unique("Seasons League"));
    await signInAs(context, host.uid);

    await page.goto(`/leagues/${league.leagueId}`);
    await expect(page).toHaveURL(new RegExp(`${seasonUrl(league)}$`));
    await expect(page.getByText(`${league.year} season`, { exact: true })).toBeVisible();

    await page.goto(seasonUrl({ ...league, year: 2031 }));
    await expect(page.getByText("The 2031 season not found")).toBeVisible();
  });

  test("a stranger to the league cannot open its seasons", async ({ page, context, request }) => {
    const host = new Api(request, unique("host"));
    await host.signUp("host");
    const league = await host.createLeague(unique("Private League"));
    await signInAs(context, unique("stranger"));

    await page.goto(seasonUrl(league));
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByRole("heading", { name: /Private League/ })).toHaveCount(0);
  });
});
