import { expect, test } from "@playwright/test";
import { authHeaders, signInAs } from "../support/auth";
import { API_URL } from "../support/env";

test("the API accepts a stub token and rejects everything else", async ({ request }) => {
  const login = await request.post(`${API_URL}/api/auth/login`, {
    headers: authHeaders("stub-api-user"),
    data: { username: "stubby" },
  });
  expect(login.ok()).toBe(true);

  const anonymous = await request.post(`${API_URL}/api/auth/login`, { data: {} });
  expect(anonymous.status()).toBe(401);

  const forged = await request.post(`${API_URL}/api/auth/login`, {
    headers: { Authorization: "Bearer not-a-stub-token" },
    data: {},
  });
  expect(forged.status()).toBe(401);
});

test("the app boots signed in from a stub session", async ({ page, context }) => {
  await signInAs(context, "stub-ui-user");
  await page.goto("/");
  await page.getByRole("button", { name: "Profile settings" }).click();
  await expect(page.getByText("stub-ui-user@e2e.test")).toBeVisible();
  await expect(page.getByRole("button", { name: /sign in/i })).toHaveCount(0);
});
