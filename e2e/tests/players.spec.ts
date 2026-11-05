import { expect, test } from "@playwright/test";
import { Api, seasonUrl, unique } from "../support/api";
import { signInAs } from "../support/auth";
import { showPlayers } from "../support/draft";

const openPlayers = async (
  page: import("@playwright/test").Page,
  context: import("@playwright/test").BrowserContext,
  request: import("@playwright/test").APIRequestContext,
) => {
  const host = new Api(request, unique("host"));
  await host.signUp("host");
  const league = await host.createLeague(unique("Players League"));
  await signInAs(context, host.uid);
  await page.goto(seasonUrl(league, "/draft"));
  await showPlayers(page);
  return { host, league };
};

test.describe("league player list", () => {
  test("lists everyone on the playoff teams with their points and stat line", async ({
    page,
    context,
    request,
  }) => {
    await openPlayers(page, context, request);
    const rows = page.getByRole("list", { name: "Players" }).getByRole("listitem");
    await expect(rows).toHaveCount(64);
    await expect(rows.first()).toContainText(/\d+\.\d\s*20\d\d pts/);
  });

  test("position chips, NFL team and search narrow the list", async ({
    page,
    context,
    request,
  }) => {
    await openPlayers(page, context, request);
    const rows = page.getByRole("list", { name: "Players" }).getByRole("listitem");

    await page.getByRole("button", { name: "K", exact: true }).click();
    await expect(rows).toHaveCount(8);

    await page.getByRole("button", { name: "WR", exact: true }).click();
    await expect(rows).toHaveCount(16);
    await page.getByRole("searchbox", { name: "Search players" }).fill("Hale");
    await expect(rows).toHaveCount(2);
    await expect(rows.first()).toContainText("SFO");

    await page.getByRole("searchbox", { name: "Search players" }).fill("zzzz-nobody");
    await expect(rows).toHaveCount(0);
    await expect(page.getByText("No players found")).toBeVisible();
  });

  test("fantasy points use this league's scoring", async ({ page, context, request }) => {
    const { host, league } = await openPlayers(page, context, request);
    await page.getByRole("button", { name: "QB", exact: true }).click();
    const top = page.getByRole("list", { name: "Players" }).getByRole("listitem").first();
    const before = (await top.textContent()) ?? "";

    // Double the passing TD value: the top quarterback's total must go up.
    await host.patch(`/api/seasons/${league.seasonId}/settings`, { scoringPassingTd: 8 });
    await page.reload();
    await showPlayers(page);
    await page.getByRole("button", { name: "QB", exact: true }).click();
    await expect(
      page.getByRole("list", { name: "Players" }).getByRole("listitem").first(),
    ).not.toHaveText(before);
  });
});
