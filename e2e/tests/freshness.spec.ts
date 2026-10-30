import { expect, test } from "@playwright/test";
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

test.describe("data freshness and admin refresh", () => {
  test("a regular user sees how fresh the stats are but no Refresh now button", async ({
    page,
    context,
    request,
  }) => {
    const league = await draftedLeague(request);
    await signInAs(context, league.host.uid);
    await page.goto(`/league/${league.leagueId}`);

    await expect(page.getByText("Stats haven't synced yet")).toBeVisible();
    await expect(page.getByRole("button", { name: "Refresh now" })).toHaveCount(0);
  });

  test("the API refuses the refresh endpoint to a non-admin even if the button were forged", async ({
    request,
  }) => {
    const response = await request.post(`${API_URL}/api/admin/refresh/live`, {
      headers: authHeaders("someone-else"),
    });
    expect(response.status()).toBe(403);
  });

  test("an admin refreshes, gets a toast, and the freshness line updates", async ({
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

    await page.goto(`/league/${league.leagueId}`);
    await expect(page.getByText("Stats updated 5 h ago")).toBeVisible();

    await page.getByRole("button", { name: "Refresh now" }).click();

    await expect(page.getByText(/^Nothing to refresh/)).toBeVisible();
    await expect(page.getByText("Stats updated just now")).toBeVisible();
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
    await page.goto(`/league/${league.leagueId}`);

    await expect(page.getByRole("status").filter({ hasText: "Live updates paused" })).toContainText(
      "Live updates paused for today (API daily limit). Showing the last update from 42 min ago.",
    );
  });
});
