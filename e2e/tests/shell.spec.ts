import { expect, test } from "@playwright/test";
import { Api, seasonUrl, unique } from "../support/api";
import { signInAs } from "../support/auth";

test("the shell shows five destinations and the league switcher inside a league", async ({
  page,
  context,
  request,
}) => {
  const host = new Api(request, unique("shell"));
  await host.signUp("shell");
  const name = unique("Shell League");
  const league = await host.createLeague(name);
  await signInAs(context, host.uid);

  await page.goto(seasonUrl(league));
  const sections = page.getByRole("navigation", { name: "League sections" });
  for (const label of ["League", "Team", "Draft", "Feed", "More"]) {
    await expect(sections.getByRole("link", { name: label })).toBeVisible();
  }

  await page.getByRole("button", { name: new RegExp(name) }).click();
  await expect(page.getByRole("menuitem", { name: "Create a league" })).toBeVisible();
  await page.keyboard.press("Escape");

  await sections.getByRole("link", { name: "More" }).click();
  await expect(page).toHaveURL(seasonUrl(league, "/more"));
  // Settings live behind cogs and the avatar now, not in More.
  await expect(page.getByRole("link", { name: "Settings" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();

  await sections.getByRole("link", { name: "Draft" }).click();
  await expect(page).toHaveURL(seasonUrl(league, "/draft"));
  await expect(sections).toBeVisible();

  await page.getByRole("link", { name: /your leagues/ }).click();
  await expect(page).toHaveURL("/");
  await expect(sections).toHaveCount(0);
});
