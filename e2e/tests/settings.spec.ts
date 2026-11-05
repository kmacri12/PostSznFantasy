import { expect, test } from "@playwright/test";
import { Api, seasonUrl, unique } from "../support/api";
import { signInAs } from "../support/auth";

test.describe("league settings", () => {
  test("a commissioner edits scoring and the change survives a reload", async ({
    page,
    context,
    request,
  }) => {
    const host = new Api(request, unique("host"));
    await host.signUp("host");
    const league = await host.createLeague(unique("Settings League"));
    await signInAs(context, host.uid);

    await page.goto(seasonUrl(league, "/settings"));
    await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: "Unsaved changes" })).toHaveCount(0);

    await page.getByRole("button", { name: "Scoring" }).click();
    const passingTd = page.locator("#scoring-passing-td");
    await expect(passingTd).toHaveValue("4");
    await passingTd.fill("6");
    await expect(page.getByRole("region", { name: "Unsaved changes" })).toBeVisible();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Settings saved.")).toBeVisible();

    await page.reload();
    await page.getByRole("button", { name: "Scoring" }).click();
    await expect(page.locator("#scoring-passing-td")).toHaveValue("6");
  });

  test("discarding edits restores the saved values", async ({ page, context, request }) => {
    const host = new Api(request, unique("host"));
    await host.signUp("host");
    const league = await host.createLeague(unique("Discard League"));
    await signInAs(context, host.uid);

    await page.goto(seasonUrl(league, "/settings"));
    await page.getByRole("button", { name: "Scoring" }).click();
    await page.locator("#scoring-passing-td").fill("9");
    await page.getByRole("button", { name: "Discard", exact: true }).click();
    await expect(page.locator("#scoring-passing-td")).toHaveValue("4");
    await expect(page.getByRole("region", { name: "Unsaved changes" })).toHaveCount(0);
  });

  test("renaming the league in settings sticks", async ({ page, context, request }) => {
    const host = new Api(request, unique("host"));
    await host.signUp("host");
    const league = await host.createLeague(unique("Old Name"));
    await signInAs(context, host.uid);

    await page.goto(seasonUrl(league, "/settings"));
    const renamed = unique("New Name");
    const row = page.getByRole("button", { name: /^Edit league name/ });
    await row.click();
    await page.getByRole("textbox", { name: "League name" }).fill(renamed);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(row).toContainText(renamed);

    await page.reload();
    await expect(page.getByRole("button", { name: /^Edit league name/ })).toContainText(renamed);
  });

  test("a member sees only their own settings", async ({ page, context, request }) => {
    const host = new Api(request, unique("host"));
    await host.signUp("host");
    const league = await host.createLeague(unique("Readonly League"));
    const code = await host.invite(league);
    const member = new Api(request, unique("member"));
    await member.signUp("member");
    await member.joinWith(code);
    await signInAs(context, member.uid);

    await page.goto(seasonUrl(league, "/settings"));
    await expect(page.getByText("Your settings")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
    await expect(page.getByText("Commissioner settings")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Scoring" })).toHaveCount(0);
  });

  test("the commissioner shuffles and saves the draft order", async ({
    page,
    context,
    request,
  }) => {
    const host = new Api(request, unique("host"));
    await host.signUp("host");
    const league = await host.createLeague(unique("Order League"));
    await signInAs(context, host.uid);

    await page.goto(seasonUrl(league, "/settings"));
    await page.getByRole("button", { name: "Draft setup" }).click();
    await page.getByRole("button", { name: "Randomize" }).click();
    // Saving before the shuffle has landed would send the old, empty order.
    await expect(page.getByTestId("order-slot-1")).not.toContainText("Empty");
    await expect(page.getByTestId("order-slot-2")).not.toContainText("Empty");
    await page.getByRole("button", { name: "Save order" }).click();
    await expect
      .poll(
        async () =>
          (await host.get<{ order: unknown[] }>(`/api/drafts/draft-info/${league.seasonId}`)).order,
      )
      .toHaveLength(2);
  });

  test("Save order cannot send a stale order while the shuffle is still in flight", async ({
    page,
    context,
    request,
  }) => {
    const host = new Api(request, unique("host"));
    await host.signUp("host");
    const league = await host.createLeague(unique("Slow Shuffle League"));
    await signInAs(context, host.uid);

    let landShuffle!: () => void;
    const shuffleHeld = new Promise<void>((resolve) => {
      landShuffle = resolve;
    });
    await page.route("**/api/drafts/*/order/randomize", async (route) => {
      await shuffleHeld;
      await route.continue();
    });

    await page.goto(seasonUrl(league, "/settings"));
    await page.getByRole("button", { name: "Draft setup" }).click();
    await page.getByRole("button", { name: "Randomize" }).click();
    await expect(page.getByRole("button", { name: "Save order" })).toBeDisabled();

    landShuffle();
    await expect(page.getByTestId("order-slot-2")).not.toContainText("Empty");
    await page.getByRole("button", { name: "Save order" }).click();
    await expect
      .poll(
        async () =>
          (await host.get<{ order: unknown[] }>(`/api/drafts/draft-info/${league.seasonId}`)).order,
      )
      .toHaveLength(2);
    await page.unrouteAll({ behavior: "wait" });
  });

  test("a late teams list does not wipe what the commissioner already typed", async ({
    page,
    context,
    request,
  }) => {
    const host = new Api(request, unique("host"));
    await host.signUp("host");
    const league = await host.createLeague(unique("Late Teams League"));
    await signInAs(context, host.uid);

    let landTeams!: () => void;
    const teamsHeld = new Promise<void>((resolve) => {
      landTeams = resolve;
    });
    await page.route(`**/api/seasons/${league.seasonId}/teams`, async (route) => {
      await teamsHeld;
      await route.continue();
    });

    await page.goto(seasonUrl(league, "/settings"));
    await page.getByRole("button", { name: "Draft setup" }).click();
    const seconds = page.getByLabel("Seconds per pick");
    await seconds.fill("45");

    landTeams();
    await expect(page.getByTestId("order-slot-2")).toBeVisible();
    await expect(seconds).toHaveValue("45");
    await page.unrouteAll({ behavior: "wait" });
  });

  test("seconds per pick are saved with the draft setup", async ({ page, context, request }) => {
    const host = new Api(request, unique("host"));
    await host.signUp("host");
    const league = await host.createLeague(unique("Clock League"));
    await signInAs(context, host.uid);

    await page.goto(seasonUrl(league, "/settings"));
    await page.getByRole("button", { name: "Draft setup" }).click();
    await page.getByLabel("Seconds per pick").fill("45");
    await page.getByRole("button", { name: "Save draft setup" }).click();
    await expect
      .poll(
        async () =>
          (
            await host.get<{ timePerPickSeconds: number }>(
              `/api/drafts/draft-info/${league.seasonId}`,
            )
          ).timePerPickSeconds,
      )
      .toBe(45);
  });
});
