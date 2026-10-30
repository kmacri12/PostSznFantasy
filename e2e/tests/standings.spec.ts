import { expect, test } from "@playwright/test";
import { signInAs } from "../support/auth";
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

  test("when the draft completes every team is listed at zero points", async ({
    page,
    context,
    request,
  }) => {
    const league = await createDraftLeague(request, { seconds: 60, status: "in_progress" });
    await completeDraft(league);

    await signInAs(context, league.host.uid);
    await page.goto(`/league/${league.leagueId}`);

    await expect(page.getByRole("heading", { name: "No standings yet" })).toHaveCount(0);
    const standings = page.getByRole("list", { name: "Standings" });
    await expect(standings.getByRole("listitem")).toHaveCount(2);
    await expect(standings.getByText("4 alive")).toHaveCount(2);
    await expect(standings.getByText("0", { exact: true })).toHaveCount(2);
  });
});
