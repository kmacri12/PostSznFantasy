import { expect, test } from "@playwright/test";
import { Api, seasonUrl, unique } from "../support/api";
import { signInAs } from "../support/auth";
import { completeDraft, createDraftLeague } from "../support/draft";

test.describe("standings", () => {
  test("before the draft every team slot is listed and fills in as people join", async ({
    page,
    context,
    request,
  }) => {
    const host = new Api(request, unique("host"));
    await host.signUp("host");
    const league = await host.createLeague(unique("Slots League"));
    const code = await host.invite(league);
    await signInAs(context, host.uid);
    await page.goto(seasonUrl(league));

    // Phone cards and the desktop table are both in the DOM; only one is visible.
    const visible = (text: string) => page.getByText(text).locator("visible=true");
    await expect(visible("Waiting for the draft: 1 of 2 teams filled.")).toBeVisible();
    await expect(visible("Open spot")).toHaveCount(1);
    await expect(page.getByRole("heading", { name: "No standings yet" })).toHaveCount(0);

    const guest = new Api(request, unique("guest"));
    await guest.signUp("guest");
    await guest.joinWith(code);
    await page.reload();
    await expect(visible("Waiting for the draft: 2 of 2 teams filled.")).toBeVisible();
    await expect(visible("Open spot")).toHaveCount(0);
  });

  test("when the draft completes every team is listed at zero points", async ({
    page,
    context,
    request,
  }) => {
    const league = await createDraftLeague(request, { seconds: 60, status: "in_progress" });
    await completeDraft(league);

    await signInAs(context, league.host.uid);
    await page.goto(seasonUrl(league.league));

    await expect(page.getByText(/Waiting for the draft/)).toHaveCount(0);
    const standings = page.getByRole("list", { name: "Standings" });
    await expect(standings.getByRole("listitem")).toHaveCount(2);
    // Level on points and every tiebreaker, so both teams share first place.
    await expect(standings.getByText("T1", { exact: true })).toHaveCount(2);
    await expect(standings.getByText("0", { exact: true })).toHaveCount(2);

    await standings.getByRole("listitem").first().getByRole("button").click();
    await expect(standings.getByText(/Players left\s*4/)).toBeVisible();
    await expect(page.getByLabel("Starters this round").getByRole("listitem")).toHaveCount(4);
  });

  test("a team's points page lists every round and what is left on the bench", async ({
    page,
    context,
    request,
  }) => {
    const league = await createDraftLeague(request, { seconds: 60, status: "in_progress" });
    await completeDraft(league);

    await signInAs(context, league.host.uid);
    await page.goto(seasonUrl(league.league, `/teams/${league.hostTeamId}/points`));

    await expect(page.getByText("Left on the bench", { exact: true })).toBeVisible();
    for (const round of ["Wild Card", "Divisional", "Conference Championship", "Super Bowl"]) {
      await expect(page.getByRole("button", { name: new RegExp(round) })).toBeVisible();
    }
  });
});
