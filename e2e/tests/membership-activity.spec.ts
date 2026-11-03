import { expect, test } from "@playwright/test";
import { Api, seasonUrl, unique } from "../support/api";
import { signInAs } from "../support/auth";

test.describe("membership in the league feed", () => {
  test("creation, joins and a promotion read in order, and a new member sees the dot", async ({
    page,
    context,
    request,
  }) => {
    const host = new Api(request, unique("host"));
    await host.signUp("host");
    const league = await host.createLeague(unique("Feed League"), { numberTeams: 6 });
    const code = await host.invite(league);
    const guests = [unique("g1"), unique("g2"), unique("g3")].map((uid) => new Api(request, uid));
    for (const [index, guest] of guests.entries()) {
      await guest.signUp(`guest${index + 1}`);
      await guest.joinWith(code);
    }
    const { members } = await host.get<{ members: { userId: number; username: string }[] }>(
      `/api/leagues/${league.leagueId}`,
    );
    const guestTwo = members.find((m) => m.username === "guest2");
    await host.patch(`/api/leagues/${league.leagueId}/members/${guestTwo?.userId}`, {
      role: "commissioner",
    });

    await signInAs(context, guests[0].uid, "guest1");
    await page.goto(seasonUrl(league));
    const feed = page.getByRole("region", { name: /activity/i }).first();
    await expect(feed.getByText("New", { exact: false }).first()).toBeVisible();
    await feed.getByRole("button").first().click();

    const rows = feed.locator("li");
    await expect(rows.filter({ hasText: "created the league" })).toHaveCount(1);
    await expect(rows.filter({ hasText: "joined as commissioner" })).toHaveCount(1);
    await expect(rows.filter({ hasText: "guest3 joined" })).toHaveCount(1);
    await expect(rows.filter({ hasText: "made guest2 a commissioner" })).toHaveCount(1);
    if (process.env.FEED_SHOT) await feed.screenshot({ path: process.env.FEED_SHOT });
  });
});
