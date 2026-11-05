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

    await expect(page.getByText("1 of 2 teams filled. Draft date not set yet.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Copy invite link" })).toBeVisible();
    await expect(page.getByText("Open slot", { exact: true })).toHaveCount(1);

    const guest = new Api(request, unique("guest"));
    await guest.signUp("guest");
    await guest.joinWith(code);
    await page.reload();
    await expect(page.getByText("2 of 2 teams filled. Draft date not set yet.")).toBeVisible();
    await expect(page.getByText("Open slot", { exact: true })).toHaveCount(0);
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

    await expect(page.getByText("Open slot", { exact: true })).toHaveCount(0);
    const standings = page.getByRole("list", { name: "Standings" });
    await expect(standings.getByRole("listitem")).toHaveCount(2);
    // Level on points and every tiebreaker, so both teams share first place.
    await expect(standings.getByText("T1", { exact: true })).toHaveCount(2);
    // Each row shows its total and its current-round points.
    await expect(standings.getByText("0.0", { exact: true })).toHaveCount(4);

    // Both teams are tied at zero, so either row's details prove the expand control works.
    await standings.getByRole("listitem").first().getByRole("button").click();
    await expect(standings.getByRole("link", { name: "Open team page" })).toBeVisible();
    for (const round of ["Wild Card", "Divisional", "Conf. champ", "Super Bowl"]) {
      await expect(standings.getByText(round, { exact: true })).toBeVisible();
    }
  });
});
