import { expect, test } from "@playwright/test";
import { Api, unique } from "../support/api";
import { signInAs } from "../support/auth";

test("a new user creates a league through the wizard", async ({ page, context, request }) => {
  const uid = unique("creator");
  await new Api(request, uid).signUp("creator");
  await signInAs(context, uid);

  await page.goto("/");
  await page.getByRole("link", { name: "Create a league" }).click();
  await expect(page.getByRole("heading", { name: "Create a league" })).toBeVisible();

  const name = unique("Wizard League");
  await page.getByLabel("League name").fill(name);
  await page.getByLabel("Teams").fill("4");
  await page.getByRole("button", { name: "Next" }).click();
  // Team QB and team K have no default: Next stays off until both are chosen.
  await expect(page.getByRole("button", { name: "Next" })).toBeDisabled();
  await page.getByRole("radiogroup", { name: "Team QB" }).getByLabel(/^Off/).check();
  await page.getByRole("radiogroup", { name: "Team K" }).getByLabel(/^Off/).check();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByRole("heading", { name: name })).toBeVisible();
  await page.getByRole("button", { name: "Create league" }).click();

  await expect(page).toHaveURL(/\/leagues\/\d+\/seasons\/\d+$/);
  await expect(page.getByRole("heading", { name, level: 4 })).toBeVisible();
  await expect(page.getByText("4 teams · 3 open")).toBeVisible();
  await expect(page.getByText("Commissioner", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Invite friends" })).toBeVisible();

  await page.goto("/");
  await expect(page.getByRole("heading", { name })).toBeVisible();
});

test("the wizard needs a name before it lets you continue", async ({ page, context, request }) => {
  const uid = unique("creator");
  await new Api(request, uid).signUp("creator");
  await signInAs(context, uid);
  await page.goto("/create-league");
  await page.getByLabel("League name").fill("");
  await expect(page.getByRole("button", { name: "Next" })).toBeDisabled();
});

test("signed-out visitors are asked to sign in before creating a league", async ({ page }) => {
  await page.goto("/create-league");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fcreate-league$/);
  await expect(page.getByRole("heading", { name: "Sign in to PostSzn" })).toBeVisible();
});
