import { expect, test } from "@playwright/test";
import { signInAs } from "../support/auth";
import { runSeedScript } from "../support/db";
import { completeDraft, createDraftLeague } from "../support/draft";

test.describe("standings", () => {
  test("before any scores the league page says standings are not ready", async ({
    page,
    context,
    request,
  }) => {
    const league = await createDraftLeague(request);
    await signInAs(context, league.host.uid);
    await page.goto(`/league/${league.leagueId}`);

    await expect(page.getByRole("heading", { name: "No standings yet" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Open the draft room" })).toBeVisible();
  });

  test("a standings snapshot lists every team in rank order", async ({
    page,
    context,
    request,
  }) => {
    const league = await createDraftLeague(request, { seconds: 60, status: "in_progress" });
    await completeDraft(league);
    // Nothing in the app writes standings yet (see the report), so the rows are inserted.
    runSeedScript("api.scripts.seed_e2e_standings", "--league", String(league.leagueId));

    await signInAs(context, league.host.uid);
    await page.goto(`/league/${league.leagueId}`);

    await expect(page.getByRole("heading", { name: "No standings yet" })).toHaveCount(0);
    const standings = page.locator("main, body").first();
    await expect(standings.getByText("Team 1").first()).toBeVisible();
    await expect(standings.getByText("131.5").first()).toBeVisible();
    await expect(standings.getByText("98.25").first()).toBeVisible();
    const first = await standings.getByText("Team 1").first().boundingBox();
    const second = await standings.getByText("Team 2").first().boundingBox();
    expect(first && second && first.y < second.y).toBe(true);
  });
});
