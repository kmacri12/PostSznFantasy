import { expect, test } from "@playwright/test";
import { unique } from "../support/api";
import { signInAs } from "../support/auth";

test.describe("first sign-in", () => {
  test("asks what to call you, prefilled with the provider name, and keeps the choice", async ({
    page,
    context,
  }) => {
    await signInAs(context, unique("newbie"), "Pat Jones", { askForName: true });
    await page.goto("/");

    const dialog = page.getByRole("dialog", { name: "What should we call you?" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Display name")).toHaveValue("Pat Jones");
    await dialog.getByLabel("Display name").fill("Coach P");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toHaveCount(0);

    await page.reload();
    await expect(page.getByRole("dialog", { name: "What should we call you?" })).toHaveCount(0);
    await page.getByRole("button", { name: "Profile settings" }).click();
    await expect(page.getByRole("dialog", { name: "Profile settings" })).toContainText("Coach P");
  });

  test("an account with no provider name starts empty, never from the email, and cannot skip", async ({
    page,
    context,
  }) => {
    await signInAs(context, unique("quiet"), "", { askForName: true });
    await page.goto("/");

    const dialog = page.getByRole("dialog", { name: "What should we call you?" });
    await expect(dialog.getByLabel("Display name")).toHaveValue("");
    await expect(dialog.getByRole("button", { name: "Skip for now" })).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "Save" })).toBeDisabled();
    await dialog.getByLabel("Display name").fill("   ");
    await expect(dialog.getByRole("button", { name: "Save" })).toBeDisabled();

    // Escape does not close it; the app stays behind the prompt until a name is saved.
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
    await page.reload();
    await expect(page.getByRole("dialog", { name: "What should we call you?" })).toBeVisible();

    await page
      .getByRole("dialog", { name: "What should we call you?" })
      .getByLabel("Display name")
      .fill("Kyle Macri");
    await page
      .getByRole("dialog", { name: "What should we call you?" })
      .getByRole("button", { name: "Save" })
      .click();
    await expect(page.getByRole("dialog", { name: "What should we call you?" })).toHaveCount(0);
  });
});
