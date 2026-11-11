import { expect, test } from "@playwright/test";
import { Api, seasonUrl, unique } from "../support/api";
import { signInAs } from "../support/auth";

test("back closes an open sheet instead of leaving the page", async ({
  page,
  context,
  request,
}) => {
  const host = new Api(request, unique("back"));
  await host.signUp("back");
  const league = await host.createLeague(unique("Back League"));
  await signInAs(context, host.uid);

  await page.goto(seasonUrl(league));
  await page
    .getByRole("navigation", { name: "League sections" })
    .getByRole("link", { name: "More" })
    .click();
  await expect(page).toHaveURL(seasonUrl(league, "/more"));

  await page.getByRole("button", { name: /^Report a problem/ }).click();
  const sheet = page.getByRole("dialog", { name: "Report a problem" });
  await expect(sheet).toBeVisible();

  await page.goBack();
  await expect(sheet).toHaveCount(0);
  await expect(page).toHaveURL(seasonUrl(league, "/more"));

  // Closing in the UI leaves no extra history entry: one back now leaves More.
  await page.getByRole("button", { name: /^Report a problem/ }).click();
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button", { name: "Cancel" }).click();
  await expect(sheet).toHaveCount(0);
  await page.goBack();
  await expect(page).toHaveURL(seasonUrl(league));
});
