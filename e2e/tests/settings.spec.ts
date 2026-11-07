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
    await expect(page.getByRole("heading", { name: "League settings", exact: true })).toBeVisible();
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

  test("a member sees the league settings from the cog, with nothing to change", async ({
    page,
    context,
    request,
  }) => {
    const host = new Api(request, unique("host"));
    await host.signUp("host");
    const league = await host.createLeague(unique("Readonly League"));
    const code = await host.invite(league);
    const member = new Api(request, unique("member"));
    await member.signUp("member");
    await member.joinWith(code);
    await signInAs(context, member.uid);

    await page.goto(seasonUrl(league));
    await page.getByRole("link", { name: "League settings" }).click();
    await expect(page.getByRole("heading", { name: "League settings", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Edit league/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Delete league/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Invite link/ })).toHaveCount(0);

    // The rules are there to read, but locked.
    await page.getByRole("button", { name: "Scoring" }).click();
    await expect(page.locator("#scoring-passing-td")).toHaveValue("4");
    await expect(page.locator("#scoring-passing-td")).not.toBeEditable();

    await page.getByRole("button", { name: /^Members/ }).click();
    const members = page.getByRole("dialog", { name: "Members" });
    await expect(members.getByText("Commissioner", { exact: true })).toBeVisible();
    await expect(members.getByRole("switch")).toHaveCount(0);
  });
});
