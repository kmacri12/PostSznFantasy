import { expect, test } from "@playwright/test";
import { Api, seasonUrl, unique } from "../support/api";
import { signInAs } from "../support/auth";

test.describe("delete a league", () => {
  test("a commissioner deletes in three steps; members then see the deleted page", async ({
    page,
    context,
    browser,
    request,
  }) => {
    const host = new Api(request, unique("host"));
    await host.signUp("host");
    const leagueName = unique("Doomed League");
    const league = await host.createLeague(leagueName);
    const guest = new Api(request, unique("guest"));
    await guest.signUp("guest");
    await guest.joinWith(await host.invite(league));
    const stranger = new Api(request, unique("stranger"));
    await stranger.signUp("stranger");

    await signInAs(context, host.uid);
    await page.goto(seasonUrl(league, "/settings"));
    await page.getByRole("button", { name: "Delete league", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Delete league", exact: true, expanded: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Delete league", exact: true })
      .and(page.locator(":not([aria-expanded])"))
      .click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("permanent and cannot be undone")).toBeVisible();
    await expect(dialog.getByText(/its 1 season,/)).toBeVisible();
    await dialog.getByRole("button", { name: "Continue" }).click();

    const proceed = dialog.getByRole("button", { name: "Continue" });
    await dialog.getByLabel("League name").fill(leagueName.toLowerCase());
    await expect(proceed).toBeDisabled();
    await dialog.getByLabel("League name").fill(leagueName);
    await proceed.click();

    await expect(dialog.getByRole("heading", { name: "Are you sure?" })).toBeVisible();
    await dialog.getByRole("button", { name: "Delete league forever" }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText(leagueName)).toHaveCount(0);

    const guestContext = await browser.newContext();
    await signInAs(guestContext, guest.uid);
    const guestPage = await guestContext.newPage();
    await guestPage.goto(seasonUrl(league));
    await expect(guestPage.getByText("This league was deleted by a commissioner")).toBeVisible();
    await expect(guestPage.getByText(`${leagueName} was deleted on`)).toBeVisible();
    await guestContext.close();

    const strangerContext = await browser.newContext();
    await signInAs(strangerContext, stranger.uid);
    const strangerPage = await strangerContext.newPage();
    await strangerPage.goto(seasonUrl(league));
    await expect(strangerPage.getByText("League not found")).toBeVisible();
    await expect(strangerPage.getByText("This league was deleted by a commissioner")).toHaveCount(
      0,
    );
    await strangerContext.close();
  });
});
