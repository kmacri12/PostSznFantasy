import { expect, test } from "@playwright/test";
import { unique } from "../support/api";
import { signInAs } from "../support/auth";

test.describe("sign in", () => {
  test("a visitor requests a magic link and sees the confirmation", async ({ page }) => {
    // Supabase is not running; the OTP endpoint is the one network edge we fake.
    await page.route("**/auth/v1/otp**", (route) => route.fulfill({ status: 200, body: "{}" }));
    await page.goto("/sign-in");
    await expect(page.getByRole("heading", { name: /sign in to postszn/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /continue with google/i })).toBeVisible();

    await page.getByLabel("Email").fill("fan@e2e.test");
    await page.getByRole("button", { name: /email me a sign-in link/i }).click();
    await expect(page.getByText(/check your email/i)).toBeVisible();
    await expect(page.getByText("fan@e2e.test")).toBeVisible();
    await expect(page.getByRole("button", { name: /resend/i })).toBeVisible();
  });

  test("a rejected magic link request shows an error and keeps the form", async ({ page }) => {
    await page.route("**/auth/v1/otp**", (route) =>
      route.fulfill({
        status: 429,
        contentType: "application/json",
        body: '{"code":"over_email_send_rate_limit"}',
      }),
    );
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill("fan@e2e.test");
    await page.getByRole("button", { name: /email me a sign-in link/i }).click();
    await expect(page.getByText(/too many emails/i)).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
  });

  test("an expired link shows a retry hint", async ({ page }) => {
    await page.goto(
      "/sign-in#error=access_denied&error_code=otp_expired&error_description=expired",
    );
    await expect(page.getByText(/expired or was already used/i)).toBeVisible();
  });

  test("a signed-in user is sent on from the sign-in page and can sign out", async ({
    page,
    context,
  }) => {
    await signInAs(context, unique("signin"));
    await page.goto("/sign-in");
    await expect(page).toHaveURL(/\/(welcome)?$/);

    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Account menu" })).toHaveCount(0);
  });
});
