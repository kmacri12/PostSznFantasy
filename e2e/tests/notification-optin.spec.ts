import { expect, test } from "@playwright/test";
import { Api, seasonUrl, unique } from "../support/api";
import { signInAs } from "../support/auth";
import { ANDROID_USER_AGENT, pushStubCalls, stubPush } from "../support/push";

const PROMPT = "Get notified when it matters";

test.describe("notification opt-in", () => {
  test.describe("on Android", () => {
    test.use({ userAgent: ANDROID_USER_AGENT });

    test("first sign-in offers it once; Turn on asks the browser from the tap and turns the switch on", async ({
      page,
      context,
      request,
    }) => {
      await stubPush(page, { answer: "granted" });
      const uid = unique("newcomer");
      await new Api(request, uid).signUp("newcomer");
      await signInAs(context, uid);

      await page.goto("/");
      const sheet = page.getByRole("dialog", { name: PROMPT });
      await expect(sheet.getByText("Allow when Chrome asks")).toBeVisible();
      await expect(sheet.getByText(/your profile settings/)).toBeVisible();
      expect((await pushStubCalls(page)).asked).toBe(0);

      await sheet.getByRole("button", { name: "Turn on notifications" }).click();
      await expect(sheet.getByText("Notifications are on")).toBeVisible();
      expect(await pushStubCalls(page)).toEqual({ asked: 1, subscribed: 1 });
      await sheet.getByRole("button", { name: "Done", exact: true }).click();
      await expect(sheet).toBeHidden();

      const league = await new Api(request, uid).createLeague(unique("Opt In League"));
      await page.goto(seasonUrl(league));
      await page.getByRole("button", { name: "Profile settings" }).click();
      await expect(page.getByRole("switch", { name: "Notifications" })).toBeChecked();
      await page.unrouteAll({ behavior: "wait" });
    });

    test("Not now closes it, and it does not come back on a reload the same day", async ({
      page,
      context,
      request,
    }) => {
      await stubPush(page, { answer: "granted" });
      const uid = unique("newcomer");
      await new Api(request, uid).signUp("newcomer");
      await signInAs(context, uid);

      await page.goto("/");
      const sheet = page.getByRole("dialog", { name: PROMPT });
      await sheet.getByRole("button", { name: "Not now" }).click();
      await expect(sheet).toBeHidden();
      expect((await pushStubCalls(page)).asked).toBe(0);

      await page.reload();
      await expect(page.getByRole("heading", { name: "Welcome to PostSzn" })).toBeVisible();
      await expect(sheet).toBeHidden();
      await page.unrouteAll({ behavior: "wait" });
    });

    test("joining a league by link offers it, but creating one does not", async ({
      page,
      context,
      request,
    }) => {
      await stubPush(page, { answer: "granted" });
      const host = new Api(request, unique("host"));
      await host.signUp("host");
      const league = await host.createLeague(unique("Join Opt In"));
      const code = await host.invite(league);

      const guest = unique("guest");
      await new Api(request, guest).signUp("guest");
      await signInAs(context, guest);
      await page.goto(`/join/${code}`);
      const sheet = page.getByRole("dialog", { name: PROMPT });
      await expect(page.getByRole("button", { name: "Join league" })).toBeVisible();
      await expect(sheet).toBeHidden();

      await page.getByRole("button", { name: "Join league" }).click();
      await expect(page).toHaveURL(new RegExp(`${seasonUrl(league)}$`));
      // The first-run tour comes first; the prompt follows once it is closed.
      await expect(sheet).toBeHidden();
      await page.getByRole("button", { name: "Skip" }).click();
      await expect(sheet).toBeVisible();
      await page.unrouteAll({ behavior: "wait" });
    });

    test("creating a league never opens it", async ({ page, context, request }) => {
      await stubPush(page, { answer: "granted" });
      const uid = unique("creator");
      await new Api(request, uid).signUp("creator");
      await signInAs(context, uid);

      await page.goto("/create-league");
      await page.getByLabel("League name").fill(unique("Created League"));
      await page.getByRole("button", { name: "Create league" }).click();
      await expect(page).toHaveURL(/\/leagues\/\d+$/);
      await page.getByRole("button", { name: "Skip" }).click();
      await expect(page.getByText("Invite your friends")).toBeVisible();
      await expect(page.getByRole("dialog", { name: PROMPT })).toBeHidden();
      await page.unrouteAll({ behavior: "wait" });
    });

    test("a browser that blocks the permission gets the steps to unblock it", async ({
      page,
      context,
      request,
    }) => {
      await stubPush(page, { answer: "denied" });
      const uid = unique("newcomer");
      await new Api(request, uid).signUp("newcomer");
      await signInAs(context, uid);

      await page.goto("/");
      const sheet = page.getByRole("dialog", { name: PROMPT });
      await sheet.getByRole("button", { name: "Turn on notifications" }).click();
      await expect(sheet.getByText(/Chrome open the menu, Settings, Site settings/)).toBeVisible();
      await expect(sheet.getByRole("button", { name: "Turn on notifications" })).toBeHidden();
      await page.unrouteAll({ behavior: "wait" });
    });

    test("already blocked in the browser: no prompt at all", async ({ page, context, request }) => {
      await stubPush(page, { answer: "denied", permission: "denied" });
      const uid = unique("newcomer");
      await new Api(request, uid).signUp("newcomer");
      await signInAs(context, uid);

      await page.goto("/");
      await expect(page.getByRole("heading", { name: "Welcome to PostSzn" })).toBeVisible();
      await expect(page.getByRole("dialog", { name: PROMPT })).toBeHidden();
      await page.unrouteAll({ behavior: "wait" });
    });
  });

  test("an iPhone in a normal Safari tab sees the Home Screen steps instead of the button", async ({
    page,
    context,
    request,
  }) => {
    await stubPush(page, { answer: "granted" });
    const uid = unique("newcomer");
    await new Api(request, uid).signUp("newcomer");
    await signInAs(context, uid);

    await page.goto("/");
    const sheet = page.getByRole("dialog", { name: PROMPT });
    await expect(sheet.getByText(/Add to Home Screen/)).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Turn on notifications" })).toBeHidden();
    await sheet.getByRole("button", { name: "Not now" }).click();
    await expect(sheet).toBeHidden();
    await page.unrouteAll({ behavior: "wait" });
  });

  test("no prompt when the server has no push keys", async ({ page, context, request }) => {
    const uid = unique("newcomer");
    await new Api(request, uid).signUp("newcomer");
    await signInAs(context, uid);

    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Welcome to PostSzn" })).toBeVisible();
    await expect(page.getByRole("dialog", { name: PROMPT })).toBeHidden();
  });
});
