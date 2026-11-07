import { expect, test } from "@playwright/test";
import { Api, seasonUrl, unique } from "../support/api";
import { signInAs } from "../support/auth";

// A real 1x1 PNG: the browser decodes and crops it like any photo.
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const picture = { name: "me.png", mimeType: "image/png", buffer: PIXEL };

test.describe("pictures", () => {
  test("a member sets a profile picture, sees it in the header and removes it", async ({
    page,
    context,
    request,
  }) => {
    const member = new Api(request, unique("pic"));
    await member.signUp("picker");
    const league = await member.createLeague(unique("Picture League"));
    await signInAs(context, member.uid);
    await page.goto(seasonUrl(league, "/settings"));

    const header = page.getByRole("button", { name: "Account menu" });
    await expect(header.locator("img")).toHaveCount(0);

    await page.getByRole("button", { name: /^Profile picture/ }).click();
    const sheet = page.getByRole("dialog", { name: "Profile picture" });
    await sheet.getByLabel("Choose a picture").setInputFiles(picture);
    await sheet.getByRole("button", { name: "Save picture" }).click();
    await expect(sheet).toHaveCount(0);

    const shown = header.locator("img");
    await expect(shown).toHaveCount(1);
    const src = await shown.getAttribute("src");
    expect(src).toMatch(/\/api\/avatars\/[0-9a-f]{32}$/);
    expect((await request.get(src ?? "")).status()).toBe(200);

    await page.reload();
    await expect(header.locator("img")).toHaveCount(1);

    await page.getByRole("button", { name: /^Profile picture/ }).click();
    await page
      .getByRole("dialog", { name: "Profile picture" })
      .getByRole("button", { name: "Remove picture" })
      .click();
    await expect(header.locator("img")).toHaveCount(0);
    expect((await request.get(src ?? "")).status()).toBe(404);
  });

  test("a file that is not an image is refused in the sheet", async ({
    page,
    context,
    request,
  }) => {
    const member = new Api(request, unique("pic"));
    await member.signUp("picker");
    const league = await member.createLeague(unique("Refuse League"));
    await signInAs(context, member.uid);
    await page.goto(seasonUrl(league, "/settings"));

    await page.getByRole("button", { name: /^Profile picture/ }).click();
    const sheet = page.getByRole("dialog", { name: "Profile picture" });
    await sheet.getByLabel("Choose a picture").setInputFiles({
      name: "notes.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.7"),
    });
    await expect(sheet.getByRole("alert")).toContainText("isn't an image");
    await expect(sheet.getByRole("button", { name: "Save picture" })).toHaveCount(0);
  });

  test("a commissioner sets the league and team pictures; they show in the switcher and standings", async ({
    page,
    context,
    request,
  }) => {
    const host = new Api(request, unique("host"));
    await host.signUp("host");
    const name = unique("Badge League");
    const league = await host.createLeague(name);
    await signInAs(context, host.uid);
    await page.goto(seasonUrl(league, "/settings"));

    await page.getByRole("button", { name: /^League picture/ }).click();
    const leagueSheet = page.getByRole("dialog", { name: "League picture" });
    await leagueSheet.getByLabel("Choose a picture").setInputFiles(picture);
    await leagueSheet.getByRole("button", { name: "Save picture" }).click();
    await expect(leagueSheet).toHaveCount(0);

    await page.getByRole("button", { name: /^Team picture/ }).click();
    const teamSheet = page.getByRole("dialog", { name: "Team picture" });
    await teamSheet.getByLabel("Choose a picture").setInputFiles(picture);
    await teamSheet.getByRole("button", { name: "Save picture" }).click();
    await expect(teamSheet).toHaveCount(0);

    const switcher = page.getByRole("button", { name: new RegExp(name) });
    await expect(switcher.locator('img[src*="/api/avatars/"]')).toHaveCount(1);

    await page.goto(seasonUrl(league));
    await expect(page.locator('img[src*="/api/avatars/"]').first()).toBeVisible(); // any standings row picture will do
  });

  test("a plain member cannot set the league picture", async ({ page, context, request }) => {
    const host = new Api(request, unique("host"));
    await host.signUp("host");
    const league = await host.createLeague(unique("Plain League"));
    const guest = new Api(request, unique("guest"));
    await guest.signUp("guest");
    await guest.joinWith(await host.invite(league));
    await signInAs(context, guest.uid);
    await page.goto(seasonUrl(league, "/settings"));

    await expect(page.getByRole("button", { name: /^Profile picture/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^League picture/ })).toHaveCount(0);
  });
});
