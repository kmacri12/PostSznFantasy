import { expect, test } from "@playwright/test";
import { Api, seasonUrl, unique } from "../support/api";
import { signInAs } from "../support/auth";

test.describe("players page", () => {
  test("lists the quarterbacks first, highest scoring on top", async ({
    page,
    context,
    request,
  }) => {
    const user = new Api(request, unique("fan"));
    await user.signUp("fan");
    await signInAs(context, user.uid);
    await page.goto("/players");

    const rows = page.getByRole("list", { name: "Players" }).getByRole("listitem");
    await expect(rows).toHaveCount(8);
    await expect(rows.first()).toContainText("QB");
  });

  test("position chips and search narrow the list", async ({ page, context, request }) => {
    const user = new Api(request, unique("fan"));
    await user.signUp("fan");
    await signInAs(context, user.uid);
    await page.goto("/players");
    const rows = page.getByRole("list", { name: "Players" }).getByRole("listitem");

    await page.getByRole("button", { name: "K", exact: true }).click();
    await expect(rows).toHaveCount(8);
    await expect(rows.first()).toContainText("K ·");

    await page.getByRole("button", { name: "WR", exact: true }).click();
    await expect(rows).toHaveCount(16);
    await page.getByRole("searchbox", { name: "Search players" }).fill("Hale");
    await expect(rows).toHaveCount(2);
    await expect(rows.first()).toContainText("SFO");

    await page.getByRole("searchbox", { name: "Search players" }).fill("zzzz-nobody");
    await expect(rows).toHaveCount(0);
  });

  test("with a league selected, fantasy points use that league's scoring", async ({
    page,
    context,
    request,
  }) => {
    const host = new Api(request, unique("host"));
    await host.signUp("host");
    const league = await host.createLeague(unique("Points League"));
    await signInAs(context, host.uid);

    await page.goto(seasonUrl(league, "/players"));
    await expect(page.getByText("Fantasy points use")).toBeVisible();
    const topPoints = page.getByRole("list", { name: "Players" }).getByRole("heading").first();
    const before = Number(await topPoints.textContent());
    expect(before).toBeGreaterThan(0);

    // Double the passing TD value: every quarterback's total must go up.
    await host.patch(`/api/seasons/${league.seasonId}/settings`, { scoringPassingTd: 8 });
    await page.reload();
    await expect(
      page.getByRole("list", { name: "Players" }).getByRole("heading").first(),
    ).not.toHaveText(String(before));
  });
});
