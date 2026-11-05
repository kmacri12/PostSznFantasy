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
    await expect(page.getByRole("heading", { name: "League Settings" })).toBeVisible();
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

  test("renaming the league from the league page sticks", async ({ page, context, request }) => {
    const host = new Api(request, unique("host"));
    await host.signUp("host");
    const league = await host.createLeague(unique("Old Name"));
    await signInAs(context, host.uid);

    await page.goto(seasonUrl(league));
    await page.getByRole("button", { name: "Rename league" }).click();
    const renamed = unique("New Name");
    await page.getByLabel("League name").fill(renamed);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("heading", { name: renamed, level: 4 })).toBeVisible();
  });

  test("a member sees the settings read-only", async ({ page, context, request }) => {
    const host = new Api(request, unique("host"));
    await host.signUp("host");
    const league = await host.createLeague(unique("Readonly League"));
    const code = await host.invite(league);
    const member = new Api(request, unique("member"));
    await member.signUp("member");
    await member.joinWith(code);
    await signInAs(context, member.uid);

    await page.goto(seasonUrl(league, "/settings"));
    await expect(page.getByText("Only commissioners can change settings.")).toBeVisible();
    await page.getByRole("button", { name: "Scoring" }).click();
    await expect(page.locator("#scoring-passing-td")).toHaveJSProperty("readOnly", true);
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
    await page.getByRole("button", { name: "Randomize" }).click();
    await page.getByRole("button", { name: "Save order" }).click();
    await expect
      .poll(
        async () =>
          (await host.get<{ order: unknown[] }>(`/api/drafts/draft-info/${league.seasonId}`)).order,
      )
      .toHaveLength(2);
  });

  test("seconds per pick are saved with the draft setup", async ({ page, context, request }) => {
    const host = new Api(request, unique("host"));
    await host.signUp("host");
    const league = await host.createLeague(unique("Clock League"));
    await signInAs(context, host.uid);

    await page.goto(seasonUrl(league, "/settings"));
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
