import { expect, test } from "@playwright/test";
import { Api, unique } from "../support/api";
import { signInAs } from "../support/auth";

test("a new user creates a league from just a name and a team count", async ({
  page,
  context,
  request,
}) => {
  const uid = unique("creator");
  await new Api(request, uid).signUp("creator");
  await signInAs(context, uid);

  await page.goto("/");
  await page.getByRole("link", { name: "Create a league" }).click();
  await expect(page.getByRole("heading", { name: "Create a league" })).toBeVisible();

  const name = unique("Short League");
  await page.getByLabel("League name").fill(name);
  await page.getByRole("button", { name: "Fewer teams" }).click();
  await page.getByRole("button", { name: "Fewer teams" }).click();
  await expect(page.getByRole("status")).toHaveText("4");
  await page.getByRole("button", { name: "Create league" }).click();

  await expect(page).toHaveURL(/\/leagues\/\d+$/);
  await expect(page.getByRole("heading", { name, level: 4 })).toBeVisible();
  await expect(page.getByText("4 teams · 3 open")).toBeVisible();
  await expect(page.getByText("Commissioner", { exact: true })).toBeVisible();

  await page.goto("/");
  await expect(page.getByRole("link", { name: new RegExp(name) })).toBeVisible();
});

test("Customize rules walks the roster, scoring and review steps", async ({
  page,
  context,
  request,
}) => {
  const uid = unique("creator");
  await new Api(request, uid).signUp("creator");
  await signInAs(context, uid);

  await page.goto("/create-league");
  const name = unique("Custom League");
  await page.getByLabel("League name").fill(name);
  await page.getByRole("button", { name: "Customize rules" }).click();
  // Team QB and team K are both visible here, off unless changed.
  await expect(page.getByRole("radiogroup", { name: "Team QB" }).getByLabel(/^Off/)).toBeChecked();
  await page.getByRole("radiogroup", { name: "Team K" }).getByLabel(/^On/).check();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await expect(page.getByText(/Team QB off · Team K on/)).toBeVisible();
  await page.getByRole("button", { name: "Create league" }).click();

  await expect(page).toHaveURL(/\/leagues\/\d+$/);
  await expect(page.getByRole("heading", { name, level: 4 })).toBeVisible();
});

test("the form needs a name before it lets you create", async ({ page, context, request }) => {
  const uid = unique("creator");
  await new Api(request, uid).signUp("creator");
  await signInAs(context, uid);
  await page.goto("/create-league");
  await expect(page.getByRole("button", { name: "Create league" })).toBeDisabled();
});

test("signed-out visitors are asked to sign in before creating a league", async ({ page }) => {
  await page.goto("/create-league");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fcreate-league$/);
  await expect(page.getByRole("heading", { name: "Sign in to PostSzn" })).toBeVisible();
});
