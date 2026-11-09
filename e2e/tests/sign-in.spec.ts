import { expect, test } from "@playwright/test";
import { unique } from "../support/api";
import { signInAs } from "../support/auth";

test.describe("sign in", () => {
  test("a visitor requests a code and is asked to enter it", async ({ page }) => {
    // Supabase is not running; the OTP endpoint is the one network edge we fake.
    await page.route("**/auth/v1/otp**", (route) => route.fulfill({ status: 200, body: "{}" }));
    await page.goto("/sign-in");
    await expect(page.getByRole("heading", { name: /sign in to postszn/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /continue with google/i })).toBeVisible();

    await page.getByLabel("Email").fill("fan@e2e.test");
    await page.getByRole("button", { name: /email me a sign-in code/i }).click();
    await expect(page.getByLabel("Sign-in code")).toBeVisible();
    await expect(page.getByText("fan@e2e.test")).toBeVisible();
    await expect(page.getByRole("button", { name: /resend code/i })).toBeVisible();
  });

  test("a wrong code shows an error and keeps the code field", async ({ page }) => {
    await page.route("**/auth/v1/otp**", (route) => route.fulfill({ status: 200, body: "{}" }));
    await page.route("**/auth/v1/verify**", (route) =>
      route.fulfill({
        status: 403,
        contentType: "application/json",
        body: '{"code":403,"error_code":"otp_expired","msg":"Token has expired or is invalid"}',
      }),
    );
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill("fan@e2e.test");
    await page.getByRole("button", { name: /email me a sign-in code/i }).click();
    await page.getByLabel("Sign-in code").fill("000000");
    await page.getByLabel("Sign-in code").press("Enter");
    await expect(page.getByText(/wrong or has expired/i)).toBeVisible();
    await expect(page.getByLabel("Sign-in code")).toBeVisible();
  });

  test("a rejected code request shows an error and keeps the form", async ({ page }) => {
    await page.route("**/auth/v1/otp**", (route) =>
      route.fulfill({
        status: 429,
        contentType: "application/json",
        body: '{"code":"over_email_send_rate_limit"}',
      }),
    );
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill("fan@e2e.test");
    await page.getByRole("button", { name: /email me a sign-in code/i }).click();
    await expect(page.getByText(/too many emails/i)).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
  });

  test("a failed Google callback shows a retry hint", async ({ page }) => {
    await page.goto("/sign-in#error=access_denied&error_code=access_denied&error_description=no");
    await expect(page.getByText(/couldn't finish signing you in/i)).toBeVisible();
  });

  test("a signed-in user is sent on from the sign-in page and can sign out", async ({
    page,
    context,
  }) => {
    await signInAs(context, unique("signin"));
    await page.goto("/sign-in");
    await expect(page).toHaveURL(/\/$/);

    await page.getByRole("button", { name: "Profile settings" }).click();
    await page
      .getByRole("dialog", { name: "Profile settings" })
      .getByRole("button", { name: "Sign out" })
      .click();
    await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Profile settings" })).toHaveCount(0);
  });
});
