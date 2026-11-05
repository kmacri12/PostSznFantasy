import { expect, test } from "@playwright/test";
import { Api, seasonUrl, unique } from "../support/api";
import { signInAs } from "../support/auth";

test.describe("invite and join", () => {
  test("a commissioner regenerates the code and the old one stops working", async ({
    page,
    context,
    request,
  }) => {
    const host = new Api(request, unique("host"));
    await host.signUp("host");
    const league = await host.createLeague(unique("Invite League"));
    await host.invite(league);
    await signInAs(context, host.uid);

    await page.goto(seasonUrl(league));
    const codeBox = page.locator('[aria-label="Invite code"]');
    const first = (await codeBox.textContent()) ?? "";
    expect(first).toMatch(/^[A-Z0-9]{8}$/);

    await page.getByRole("button", { name: "Regenerate" }).click();
    await expect(codeBox).not.toHaveText(first);

    const stale = await request.get(`http://localhost:8100/api/invites/${first}`);
    expect((await stale.json()).joinable).toBe(false);
  });

  test("a revoked invite can no longer be used", async ({ page, context, request }) => {
    const host = new Api(request, unique("host"));
    await host.signUp("host");
    const league = await host.createLeague(unique("Revoke League"));
    const code = await host.invite(league);
    await signInAs(context, host.uid);

    await page.goto(seasonUrl(league));
    await page.getByRole("button", { name: "Revoke" }).click();
    await expect(page.getByRole("button", { name: "Revoke" })).toHaveCount(0);

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
    await expect(page.getByRole("heading", { name: leagueName, level: 4 })).toBeVisible();
    await expect(page.getByText("Member", { exact: true })).toBeVisible();
    await expect(page.getByText("2 teams · 0 open")).toBeVisible();
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
