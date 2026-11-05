import { expect, test } from "@playwright/test";
import { Api, seasonUrl, unique } from "../support/api";
import { authHeaders, signInAs } from "../support/auth";
import { API_URL } from "../support/env";

test.describe("invite and join", () => {
  // The invite controls (regenerate, revoke) live in Settings; these cover what they call.
  test("regenerating the code retires the old one", async ({ request }) => {
    const host = new Api(request, unique("host"));
    await host.signUp("host");
    const league = await host.createLeague(unique("Invite League"));
    const first = await host.invite(league);
    const second = await host.invite(league);
    expect(second).not.toBe(first);

    const preview = async (code: string) =>
      (
        (await (await request.get(`${API_URL}/api/invites/${code}`)).json()) as {
          joinable: boolean;
        }
      ).joinable;
    expect(await preview(first)).toBe(false);
    expect(await preview(second)).toBe(true);
  });

  test("a revoked invite can no longer be used", async ({ page, request }) => {
    const host = new Api(request, unique("host"));
    await host.signUp("host");
    const league = await host.createLeague(unique("Revoke League"));
    const code = await host.invite(league);
    const revoked = await request.delete(`${API_URL}/api/leagues/${league.leagueId}/invite`, {
      headers: authHeaders(host.uid),
    });
    expect(revoked.ok()).toBe(true);

    await page.goto(`/join/${code}`);
    await expect(page.getByRole("alert")).toBeVisible();
  });

  test("a signed-out guest signs in, joins by link and sees the league", async ({
    page,
    context,
    request,
  }) => {
    const host = new Api(request, unique("host"));
    await host.signUp("host");
    const leagueName = unique("Join League");
    const league = await host.createLeague(leagueName);
    const code = await host.invite(league);

    await page.goto(`/join/${code}`);
    await expect(page.getByRole("heading", { name: leagueName })).toBeVisible();
    await expect(page.getByText("Open slot")).toBeVisible();
    await page.getByRole("link", { name: "Sign in to join" }).click();
    await expect(page).toHaveURL(/sign-in\?next=%2Fjoin%2F/);

    // The emailed-code round trip is covered in sign-in.spec; here the session just arrives.
    await signInAs(context, unique("guest"));
    await page.goto(`/join/${code}`);
    await page.getByRole("button", { name: "Join league" }).click();
    await expect(page).toHaveURL(new RegExp(`${seasonUrl(league)}$`));
    await expect(page.getByText("Draft not yet scheduled by your commissioner")).toBeVisible();
    await expect(page.getByText("2 of 2 teams filled.")).toBeVisible();
  });

  test("the join code box on the home page opens the invite", async ({
    page,
    context,
    request,
  }) => {
    const host = new Api(request, unique("host"));
    await host.signUp("host");
    const leagueName = unique("Code League");
    const code = await host.invite(await host.createLeague(leagueName));

    await signInAs(context, unique("guest"));
    await page.goto("/");
    await page.getByRole("textbox", { name: "Invite code" }).fill(code);
    await page.getByRole("button", { name: "Join", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/join/${code}$`));
    await expect(page.getByRole("heading", { name: leagueName, level: 1 })).toBeVisible();
  });

  test("a full league explains why it cannot be joined", async ({ page, context, request }) => {
    const host = new Api(request, unique("host"));
    await host.signUp("host");
    const league = await host.createLeague(unique("Full League"));
    const code = await host.invite(league);
    const other = new Api(request, unique("other"));
    await other.signUp("other");
    await other.joinWith(code);

    await signInAs(context, unique("late"));
    await page.goto(`/join/${code}`);
    await expect(page.getByText("This league is full")).toBeVisible();
    await expect(page.getByText(/ask your commissioner/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Join league" })).toBeDisabled();
  });
});
