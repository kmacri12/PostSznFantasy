import { expect, test } from "@playwright/test";
import { seasonUrl } from "../support/api";
import { signInAs } from "../support/auth";
import {
  createDraftLeague,
  draftFirst,
  dropSockets,
  newUserContext,
  trackSockets,
} from "../support/draft";

test.describe("draft room on a bad network", () => {
  test("a drafter who was offline is told what they missed and is current again", async ({
    browser,
    page,
    context,
    request,
  }) => {
    const league = await createDraftLeague(request, { seconds: 60, status: "in_progress" });
    await signInAs(context, league.host.uid);
    const guestContext = await newUserContext(browser, league.guest.uid);
    await trackSockets(guestContext);
    const guestPage = await guestContext.newPage();
    await guestPage.goto(seasonUrl(league.league, "/draft"));
    await expect(guestPage.getByText("Round 1, pick 1")).toBeVisible();
    await page.goto(seasonUrl(league.league, "/draft"));

    await guestContext.setOffline(true);
    await dropSockets(guestPage);
    await expect(guestPage.getByText("Reconnecting…")).toBeVisible();
    await draftFirst(page, "QB");

    await guestContext.setOffline(false);
    await expect(guestPage.getByText("You're on the clock")).toBeVisible({ timeout: 20_000 });
    await expect(guestPage.getByText(/You were offline for \d+s, 1 pick made/)).toBeVisible();
    await expect(guestPage.getByText("Reconnecting…")).toHaveCount(0);
    await guestContext.close();
  });

  test("the same manager on two devices stays consistent and drafts once", async ({
    browser,
    page,
    context,
    request,
  }) => {
    const league = await createDraftLeague(request, { seconds: 60, status: "in_progress" });
    await signInAs(context, league.host.uid);
    const secondDevice = await newUserContext(browser, league.host.uid);
    const otherPage = await secondDevice.newPage();
    await page.goto(seasonUrl(league.league, "/draft"));
    await otherPage.goto(seasonUrl(league.league, "/draft"));
    await expect(page.getByText("You're on the clock")).toBeVisible();
    await expect(otherPage.getByText("You're on the clock")).toBeVisible();

    await draftFirst(page, "QB");

    await expect(otherPage.getByText("Round 1, pick 2")).toBeVisible();
    await expect(otherPage.getByText("You're on the clock")).toHaveCount(0);
    expect((await league.state()).picks).toHaveLength(1);
    await secondDevice.close();
  });

  test("a flapping connection loses no pick and leaves no stuck spinner", async ({
    browser,
    page,
    context,
    request,
  }) => {
    test.setTimeout(120_000);
    const league = await createDraftLeague(request, { seconds: 60, status: "in_progress" });
    await signInAs(context, league.host.uid);
    await trackSockets(context);
    await page.goto(seasonUrl(league.league, "/draft"));
    const guestContext = await newUserContext(browser, league.guest.uid);
    const guestPage = await guestContext.newPage();
    await guestPage.goto(seasonUrl(league.league, "/draft"));
    await expect(page.getByText("You're on the clock")).toBeVisible();

    await draftFirst(page, "QB");
    // Going offline with the pick request still in flight would drop it, not the connection under test.
    await expect.poll(async () => (await league.state()).picks.length).toBe(1);
    for (const _ of [1, 2, 3]) {
      await context.setOffline(true);
      await dropSockets(page);
      await expect(page.getByText("Reconnecting…")).toBeVisible();
      await context.setOffline(false);
      await expect(page.getByText("Reconnecting…")).toHaveCount(0, { timeout: 20_000 });
    }

    await draftFirst(guestPage, "QB");
    await draftFirst(guestPage, "RB");
    await expect(page.getByText("You're on the clock")).toBeVisible();
    await draftFirst(page, "RB");
    await expect.poll(async () => (await league.state()).picks.length).toBe(4);
    await expect(page.getByText("Round 3, pick 1")).toBeVisible();
    await guestContext.close();
  });
});
