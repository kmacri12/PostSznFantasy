import { expect, test } from "@playwright/test";
import { Api, unique } from "../support/api";
import { signInAs } from "../support/auth";

test.describe("delete my account", () => {
  test("needs the typed phrase, and the API refuses a bare request", async ({
    page,
    context,
    request,
  }) => {
    const member = new Api(request, unique("member"));
    await member.signUp("member");
    await signInAs(context, member.uid);

    // A request without the phrase is refused before anything is touched.
    expect(await member.status("DELETE", "/api/auth/me")).toBe(422);

    await page.goto("/");
    await page.getByRole("button", { name: "Profile settings" }).click();
    const profile = page.getByRole("dialog", { name: "Profile settings" });
    await expect(profile.getByRole("heading", { name: "Danger zone" })).toBeVisible();
    await profile.getByRole("button", { name: "Delete my account", exact: true }).click();

    const dialog = page.getByRole("dialog", { name: "Delete my account" });
    const confirm = dialog.getByRole("button", { name: "Delete my account", exact: true });
    await expect(confirm).toBeDisabled();
    await dialog.getByLabel("Confirmation").fill("delete");
    await expect(confirm).toBeDisabled();
    await dialog.getByLabel("Confirmation").fill("DELETE");
    await expect(confirm).toBeEnabled();
  });
});
