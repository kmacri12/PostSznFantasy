import { expect, test } from "@playwright/test";
import { Api, seasonUrl, unique } from "../support/api";
import { signInAs } from "../support/auth";

test.describe("assign a team owner", () => {
  test("a commissioner gives a member who has no team the free team", async ({
    page,
    context,
    request,
  }) => {
    const host = new Api(request, unique("host"));
    await host.signUp("host");
    const league = await host.createLeague(unique("Assign League"));
    const guest = new Api(request, unique("guest"));
    await guest.signUp("guest");
    await guest.joinWith(await host.invite(league));

    // The guest's team is freed, so the guest is a member without a team.
    const teams = await host.get<{ id: number; ownerId: number | null }[]>(
      `/api/seasons/${league.seasonId}/teams`,
    );
    const guestTeam = teams.at(-1);
    expect(guestTeam?.ownerId).not.toBeNull();
    await host.put(`/api/seasons/${league.seasonId}/teams/${guestTeam?.id}/owner`, {
      userId: null,
    });

    await signInAs(context, host.uid);
    await page.goto(seasonUrl(league, `/teams/${guestTeam?.id}`));
    await page.getByRole("button", { name: "Team settings" }).click();
    await page.getByRole("button", { name: /^Owner/ }).click();
    const sheet = page.getByRole("dialog", { name: "Team owner" });
    await expect(sheet).toBeVisible();
    await sheet.getByRole("button", { name: /^Assign guest/ }).click();
    await expect(sheet).toHaveCount(0);
    await expect(page.getByText("guest", { exact: false }).first()).toBeVisible(); // the header shows the new owner
  });
});
