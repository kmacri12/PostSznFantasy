import { expect, type Page, test } from "@playwright/test";
import { seasonUrl } from "../support/api";
import { authHeaders, signInAs } from "../support/auth";
import { completeDraft, createDraftLeague } from "../support/draft";
import { ADMIN_UID, API_URL } from "../support/env";

const draftedLeague = async (
  request: Parameters<typeof createDraftLeague>[0],
  hostUid?: string,
) => {
  const league = await createDraftLeague(request, { seconds: 60, status: "in_progress", hostUid });
  await completeDraft(league);
  return league;
};

const standingsLoaded = (page: Page) =>
  expect(
    page
      .getByRole("list", { name: "Standings" })
      .or(page.getByRole("table", { name: "Standings" })),
  ).toBeVisible();

// PullToRefresh listens to document touch events; Playwright has no touch-drag gesture, so the
// spec sends the same events a finger would.
const touch = (page: Page, type: "touchstart" | "touchmove" | "touchend", clientY: number) =>
  page.evaluate(
    ([eventType, y]) => {
      const event = new Event(eventType as string, { bubbles: true, cancelable: true });
      Object.assign(event, { touches: eventType === "touchend" ? [] : [{ clientY: y }] });
      document.dispatchEvent(event);
    },
    [type, clientY] as const,
  );

/** Pulls far enough to refresh, without letting go. */
const pullDown = async (page: Page) => {
  await touch(page, "touchstart", 100);
  await touch(page, "touchmove", 340);
};

test.describe("data freshness and admin refresh", () => {
  test("the stats sync time shows only while pulling, never on the page, and no Refresh now", async ({
    page,
    context,
    request,
  }) => {
    const league = await draftedLeague(request);
    await signInAs(context, league.host.uid);
    await page.goto(seasonUrl(league.league));
    await standingsLoaded(page);

    await expect(page.getByText(/Live stats/)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Refresh now" })).toHaveCount(0);

    await pullDown(page);
    await expect(page.getByText("Release to refresh this screen")).toBeVisible();
    await expect(page.getByText("Live stats auto-sync once games start")).toBeVisible();
    await touch(page, "touchend", 340);
    await expect(page.getByRole("status")).toContainText("This screen is up to date");
  });

  test("the API refuses the refresh endpoint to a non-admin even if the button were forged", async ({
    request,
  }) => {
    const response = await request.post(`${API_URL}/api/admin/refresh/live`, {
      headers: authHeaders("someone-else"),
    });
    expect(response.status()).toBe(403);
  });

  test("an admin refreshes, gets a toast, and the pull shows the newer sync", async ({
    page,
    context,
    request,
  }) => {
    const league = await draftedLeague(request, ADMIN_UID);
    await signInAs(context, ADMIN_UID);

    // The seeded season has no live game, so the real poll stores nothing; stand in for the
    // server stamping a newer sync once the refresh has run.
    let refreshed = false;
    await page.route("**/api/players/sync-status", (route) => {
      const lastSyncedAt = new Date(Date.now() - (refreshed ? 1_000 : 5 * 3_600_000));
      return route.fulfill({
        json: [
          {
            kind: "box_scores",
            lastSyncedAt: lastSyncedAt.toISOString(),
            budgetExhausted: false,
          },
        ],
      });
    });
    await page.route("**/api/admin/refresh/live", async (route) => {
      const response = await route.fetch();
      refreshed = true;
      await route.fulfill({ response });
    });

    await page.goto(seasonUrl(league.league));
    await standingsLoaded(page);
    await pullDown(page);
    await expect(page.getByText("Live stats auto-sync during games · synced 5 h ago")).toBeVisible();
    await touch(page, "touchend", 100);

    await page.getByRole("button", { name: "Refresh now" }).click();
    await expect(page.getByText(/^Nothing to refresh/)).toBeVisible();

    await pullDown(page);
    await expect(
      page.getByText("Live stats auto-sync during games · synced just now"),
    ).toBeVisible();
    await page.unrouteAll({ behavior: "wait" });
  });

  test("the stale notice shows when the API daily limit has stopped polling", async ({
    page,
    context,
    request,
  }) => {
    const league = await draftedLeague(request);
    await signInAs(context, league.host.uid);
    await page.route("**/api/players/sync-status", (route) =>
      route.fulfill({
        json: [
          {
            kind: "box_scores",
            lastSyncedAt: new Date(Date.now() - 42 * 60_000).toISOString(),
            budgetExhausted: true,
          },
        ],
      }),
    );
    await page.goto(seasonUrl(league.league));

    await expect(page.getByRole("status").filter({ hasText: "Live updates paused" })).toContainText(
      "Live updates paused for today (API daily limit). Showing the last update from 42 min ago.",
    );
    await page.unrouteAll({ behavior: "wait" });
  });
});
