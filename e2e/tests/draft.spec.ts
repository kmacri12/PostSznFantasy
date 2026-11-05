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

test.describe("draft room", () => {
  test("the commissioner opens the lobby and starts; the manager on the clock picks", async ({
    page,
    context,
    request,
  }) => {
    const league = await createDraftLeague(request, { seconds: 60 });
    await signInAs(context, league.host.uid);

    await page.goto(seasonUrl(league.league, "/draft"));
    await page.getByRole("button", { name: "Draft controls" }).click();
    await page.getByRole("button", { name: /open lobby/i }).click();
    await expect(page.getByRole("heading", { name: "Lobby open" })).toBeVisible();
    await page.getByRole("button", { name: "Draft controls" }).click();
    await page.getByRole("button", { name: "Start draft" }).click();
    await expect(page.getByText("Pick 1 of 8: Team 1 on the clock")).toBeVisible();
    // The banner and the status bar both say it; either one proves it is this manager's turn.
    await expect(page.getByText("You're on the clock").first()).toBeVisible();

    const drafted = await draftFirst(page, "QB");
    await expect(page.getByText(/Pick 2 of 8/)).toBeVisible();
    await page.getByRole("tab", { name: "Pick feed" }).click();
    // The pick feed and the board both show the name; either one proves the pick landed.
    await expect(page.getByText(drafted).first()).toBeVisible();
    expect((await league.state()).picks).toHaveLength(1);
  });

  test("two managers draft every round to a completed draft", async ({
    browser,
    page,
    context,
    request,
  }) => {
    test.setTimeout(120_000);
    const league = await createDraftLeague(request, { seconds: 60, status: "in_progress" });
    await signInAs(context, league.host.uid);
    const guestContext = await newUserContext(browser, league.guest.uid);
    const guestPage = await guestContext.newPage();
    await page.goto(seasonUrl(league.league, "/draft"));
    await guestPage.goto(seasonUrl(league.league, "/draft"));

    const positions = ["QB", "RB", "WR", "RB"];
    for (let overall = 1; overall <= 8; overall++) {
      const state = await league.state();
      const hostTurn = state.onTheClockTeamId === league.hostTeamId;
      const turnPage = hostTurn ? page : guestPage;
      // The banner and the status bar both say it; either one proves it is this manager's turn.
      await expect(turnPage.getByText("You're on the clock").first()).toBeVisible();
      await draftFirst(turnPage, positions[Math.ceil(overall / 2) - 1]);
      await expect.poll(async () => (await league.state()).picks.length).toBe(overall);
    }

    for (const view of [page, guestPage]) {
      await expect(view.getByRole("heading", { name: /draft complete/i })).toBeVisible();
    }
    const final = await league.state();
    expect(final.status).toBe("completed");
    expect(new Set(final.picks.map((pick) => pick.playerId)).size).toBe(8);
    await guestContext.close();
  });

  test("pausing stops the clock for everyone and resuming restarts it", async ({
    browser,
    page,
    context,
    request,
  }) => {
    const league = await createDraftLeague(request, { seconds: 60, status: "in_progress" });
    await signInAs(context, league.host.uid);
    const guestContext = await newUserContext(browser, league.guest.uid);
    const guestPage = await guestContext.newPage();
    await page.goto(seasonUrl(league.league, "/draft"));
    await guestPage.goto(seasonUrl(league.league, "/draft"));

    await page.getByRole("button", { name: "Draft controls" }).click();
    await page.getByRole("button", { name: "Pause" }).click();
    await expect.poll(async () => (await league.state()).status).toBe("paused");
    for (const view of [page, guestPage]) {
      // The banner and the status bar both say "paused"; either one proves the pause reached this tab.
      await expect(view.getByText(/paused/i).first()).toBeVisible();
    }

    await page.getByRole("button", { name: "Draft controls" }).click();
    await page.getByRole("button", { name: "Resume" }).click();
    await expect.poll(async () => (await league.state()).status).toBe("in_progress");
    await expect(guestPage.getByText(/Pick 1 of 8/)).toBeVisible();
    await expect(guestPage.getByText(/paused/i)).toHaveCount(0);
    await guestContext.close();
  });

  test("undo takes back the last pick and returns the clock", async ({
    page,
    context,
    request,
  }) => {
    const league = await createDraftLeague(request, { seconds: 60, status: "in_progress" });
    await signInAs(context, league.host.uid);
    await page.goto(seasonUrl(league.league, "/draft"));
    await draftFirst(page, "QB");
    await expect(page.getByText(/Pick 2 of 8/)).toBeVisible();

    await page.getByRole("button", { name: "Draft controls" }).click();
    await page.getByRole("button", { name: "Undo last pick" }).click();
    await expect(page.getByText(/Pick 1 of 8/)).toBeVisible();
    const state = await league.state();
    expect(state.picks).toHaveLength(0);
    expect(state.onTheClockTeamId).toBe(league.hostTeamId);
  });

  test("force pick auto-drafts for whoever is on the clock", async ({ page, context, request }) => {
    const league = await createDraftLeague(request, { seconds: 60, status: "in_progress" });
    await signInAs(context, league.host.uid);
    await page.goto(seasonUrl(league.league, "/draft"));

    await page.getByRole("button", { name: "Draft controls" }).click();
    await page.getByRole("button", { name: "Auto-pick now" }).click();
    await expect(page.getByText(/Pick 2 of 8/)).toBeVisible();
    const [pick] = (await league.state()).picks;
    expect(pick.teamId).toBe(league.hostTeamId);
    expect(pick.autopick).toBe(true);
  });

  test("an expired clock auto-picks the best available player", async ({
    page,
    context,
    request,
  }) => {
    const league = await createDraftLeague(request, { seconds: 10, status: "in_progress" });
    await signInAs(context, league.host.uid);
    await page.goto(seasonUrl(league.league, "/draft"));

    await expect.poll(async () => (await league.state()).picks.length, { timeout: 25_000 }).toBe(1);
    const [pick] = (await league.state()).picks;
    expect(pick.autopick).toBe(true);
    await expect(page.getByText(/Pick 2 of 8/)).toBeVisible();
  });

  test("auto-pick takes the queued player first", async ({ browser, page, context, request }) => {
    const league = await createDraftLeague(request, { seconds: 60, status: "in_progress" });
    await signInAs(context, league.host.uid);
    await page.goto(seasonUrl(league.league, "/draft"));

    await page.getByRole("tab", { name: "Players" }).click();
    await page.getByRole("button", { name: "WR", exact: true }).click();
    // Third row of the fixed-order WR list: deliberately not the best available, so queueing it is what makes auto-pick choose it.
    const row = page.getByRole("list", { name: "Available players" }).getByRole("listitem").nth(2);
    // A player card's first paragraph is the player's name.
    const queued = (await row.locator("p").first().textContent()) ?? "";
    await row.getByRole("button", { name: "Queue" }).click();
    await expect(page.getByRole("tab", { name: "Queue (1)" })).toBeVisible();

    await page.getByRole("button", { name: "Draft controls" }).click();
    await page.getByRole("button", { name: "Auto-pick now" }).click();
    await page.getByRole("tab", { name: "My roster" }).click();
    await expect(page.getByText(queued, { exact: true })).toBeVisible();
    void browser;
  });

  test("a manager who loses the connection catches up when it returns", async ({
    browser,
    page,
    context,
    request,
  }) => {
    const league = await createDraftLeague(request, { seconds: 60, status: "in_progress" });
    const guestContext = await newUserContext(browser, league.guest.uid);
    await trackSockets(guestContext);
    const guestPage = await guestContext.newPage();
    await guestPage.goto(seasonUrl(league.league, "/draft"));
    await expect(guestPage.getByText("Live", { exact: true })).toBeVisible();

    await signInAs(context, league.host.uid);
    await page.goto(seasonUrl(league.league, "/draft"));

    // Offline first so the socket cannot reopen before the pick it must not miss.
    await guestContext.setOffline(true);
    await dropSockets(guestPage);
    await draftFirst(page, "QB");
    await expect(guestPage.getByText(/Pick 1 of 8/)).toBeVisible();
    await expect(guestPage.getByText("Live", { exact: true })).toHaveCount(0);

    await guestContext.setOffline(false);
    await expect(guestPage.getByText(/Pick 2 of 8/)).toBeVisible({ timeout: 20_000 });
    // The banner and the status bar both say it; either one proves it is this manager's turn.
    await expect(guestPage.getByText("You're on the clock").first()).toBeVisible();
    await expect(guestPage.getByText("Live", { exact: true })).toBeVisible();
    await guestContext.close();
  });

  test("only the commissioner sees draft controls", async ({ browser, request }) => {
    const league = await createDraftLeague(request, { seconds: 60, status: "in_progress" });
    const guestContext = await newUserContext(browser, league.guest.uid);
    const guestPage = await guestContext.newPage();
    await guestPage.goto(seasonUrl(league.league, "/draft"));
    await expect(guestPage.getByRole("heading", { name: "Draft in progress" })).toBeVisible();
    await expect(guestPage.getByRole("button", { name: "Draft controls" })).toHaveCount(0);
    await guestContext.close();
  });
});

test.describe("position caps", () => {
  test("a team at its cap sees that position greyed out with the reason", async ({
    page,
    context,
    request,
  }) => {
    const league = await createDraftLeague(request, {
      seconds: 60,
      status: "in_progress",
    });
    await signInAs(context, league.host.uid);
    await page.goto(seasonUrl(league.league, "/draft"));

    await draftFirst(page, "QB");
    const players =
      await league.guest.get<{ id: number; position: string }[]>("/api/players/draft-pool");
    const rbs = players.filter((p) => p.position === "RB");
    for (const rb of rbs.slice(0, 2)) {
      await league.guest.post(`/api/drafts/${league.league.seasonId}/picks`, { playerId: rb.id });
    }
    await draftFirst(page, "QB");
    await expect(page.getByText("Pick 5 of 8")).toBeVisible();

    await page.getByRole("tab", { name: "Players" }).click();
    await page.getByRole("button", { name: "QB", exact: true }).click();
    const first = page
      .getByRole("list", { name: "Available players" })
      .getByRole("listitem")
      .first(); // The list is sorted from fixed fixtures; the top QB row is the same on every run.
    await expect(
      first.getByText("You already have 2 QBs, the most your league allows"),
    ).toBeVisible();
    await expect(first.getByRole("button", { name: "Position full" })).toBeDisabled();
    if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/capped.png` });
  });
});
