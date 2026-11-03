import { expect, test } from "@playwright/test";
import { Api, pastSeasonUrl, seasonUrl, unique } from "../support/api";
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
    await expect(page).toHaveURL(seasonUrl(league));
    await expect(page.getByText(`${league.year} season`, { exact: true })).toBeVisible();

    await page.goto(pastSeasonUrl({ ...league, year: 2031 }));
    await expect(page.getByText("The 2031 season not found")).toBeVisible();
  });

  test("the current season never shows its year, and its long form redirects", async ({
    page,
    context,
    request,
  }) => {
    const host = new Api(request, unique("clean"));
    await host.signUp("clean");
    const league = await host.createLeague(unique("Clean League"));
    await signInAs(context, host.uid);

    await page.goto("/");
    await page.goto(pastSeasonUrl(league, "/settings"));
    await expect(page).toHaveURL(seasonUrl(league, "/settings"));
    await page.goBack();
    await expect(page).toHaveURL("/");

    await page.goto(seasonUrl(league));
    await page.getByRole("link", { name: "Settings" }).first().click();
    await expect(page).toHaveURL(seasonUrl(league, "/settings"));
    await page.getByRole("link", { name: "Players" }).first().click();
    await expect(page).toHaveURL(seasonUrl(league, "/players"));
    expect(page.url()).not.toContain("/seasons/");
  });

  test("a season that is not the current one keeps its year in the address", async ({
    page,
    context,
    request,
  }) => {
    const host = new Api(request, unique("past"));
    await host.signUp("past");
    const league = await host.createLeague(unique("Past League"));
    await signInAs(context, host.uid);
    // Stands in for a league that has rolled over: its listed season is no longer the latest.
    await page.route(`**/api/leagues/${league.leagueId}/seasons`, async (route) => {
      const response = await route.fetch();
      const seasons = (await response.json()) as { current: boolean }[];
      await route.fulfill({ response, json: seasons.map((s) => ({ ...s, current: false })) });
    });

    await page.goto(pastSeasonUrl(league, "/players"));
    await expect(page).toHaveURL(pastSeasonUrl(league, "/players"));
    await expect(
      page.getByRole("table").or(page.getByRole("list", { name: "Players" })),
    ).toBeVisible();
    await page.goto("/");
    await page.goBack();
    await expect(page).toHaveURL(pastSeasonUrl(league, "/players"));
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
