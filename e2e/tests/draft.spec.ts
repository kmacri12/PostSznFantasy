import { expect, test } from "@playwright/test";
import { Api, seasonUrl, unique } from "../support/api";
import { signInAs } from "../support/auth";
import {
  createDraftLeague,
  draftFirst,
  dropSockets,
  newUserContext,
  openControls,
  showPlayers,
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
    await expect(page.getByText("Draft not scheduled yet")).toBeVisible();
    await openControls(page);
    await page.getByRole("button", { name: "Start draft" }).click();
    await expect(page.getByText("Round 1, pick 1")).toBeVisible();
    await expect(page.getByText("You're on the clock").first()).toBeVisible();

    const drafted = await draftFirst(page, "QB");
    await expect(page.getByText("Round 1, pick 2")).toBeVisible();
    const board = page.getByRole("tab", { name: "Board" });
    if (await board.count()) await board.click();
    await expect(
      page.getByLabel("Draft board").getByText(drafted.split(" ").pop() ?? ""),
    ).toBeVisible();
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
      await expect(turnPage.getByText("You're on the clock").first()).toBeVisible();
      await draftFirst(turnPage, positions[Math.ceil(overall / 2) - 1]);
      await expect.poll(async () => (await league.state()).picks.length).toBe(overall);
    }

    for (const view of [page, guestPage]) {
      await expect(view.getByRole("list", { name: "Players" })).toBeVisible();
      await expect(view.getByRole("button", { name: "Commissioner controls" })).toHaveCount(0);
      await expect(view.getByText("Draft complete")).toHaveCount(0);
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

    await openControls(page);
    await page.getByRole("button", { name: "Pause" }).click();
    await expect.poll(async () => (await league.state()).status).toBe("paused");
    for (const view of [page, guestPage]) {
      await expect(view.getByText(/paused/i).first()).toBeVisible();
    }

    await page.getByRole("button", { name: "Resume" }).click();
    await expect.poll(async () => (await league.state()).status).toBe("in_progress");
    await expect(guestPage.getByText("Round 1, pick 1")).toBeVisible();
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
    await expect(page.getByText("Round 1, pick 2")).toBeVisible();

    await openControls(page);
    await page.getByRole("button", { name: "Undo last pick" }).click();
    await expect(page.getByText("Round 1, pick 1")).toBeVisible();
    const state = await league.state();
    expect(state.picks).toHaveLength(0);
    expect(state.onTheClockTeamId).toBe(league.hostTeamId);
  });

  test("force pick auto-drafts for whoever is on the clock", async ({ page, context, request }) => {
    const league = await createDraftLeague(request, { seconds: 60, status: "in_progress" });
    await signInAs(context, league.host.uid);
    await page.goto(seasonUrl(league.league, "/draft"));

    await openControls(page);
    await page.getByRole("button", { name: "Auto-pick now" }).click();
    await expect(page.getByText("Round 1, pick 2")).toBeVisible();
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
    await expect(page.getByText("Round 1, pick 2")).toBeVisible();
  });

  test("auto-pick takes the queued player first", async ({ browser, page, context, request }) => {
    const league = await createDraftLeague(request, { seconds: 60, status: "in_progress" });
    await signInAs(context, league.host.uid);
    await page.goto(seasonUrl(league.league, "/draft"));

    await showPlayers(page);
    await page.getByRole("button", { name: "WR", exact: true }).click();
    const row = page.getByRole("list", { name: "Players" }).getByRole("listitem").nth(2);
    const queued = (await row.locator("p").first().textContent()) ?? "";
    await row.getByRole("button", { name: `Add ${queued} to queue` }).click();
    await expect(page.getByRole("button", { name: `Remove ${queued} from queue` })).toBeVisible();

    await openControls(page);
    await page.getByRole("button", { name: "Auto-pick now" }).click();
    await expect(page.getByText("Round 1, pick 2")).toBeVisible();
    const roster = page.getByRole("tab", { name: "Roster" });
    if (await roster.count()) await roster.click();
    await expect(page.getByLabel("Your roster").getByText(queued)).toBeVisible();
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
    await expect(guestPage.getByText("You're on the clock")).toHaveCount(0);
    await expect(guestPage.getByText("Reconnecting…")).toHaveCount(0);

    await signInAs(context, league.host.uid);
    await page.goto(seasonUrl(league.league, "/draft"));

    // Offline first so the socket cannot reopen before the pick it must not miss.
    await guestContext.setOffline(true);
    await dropSockets(guestPage);
    await draftFirst(page, "QB");
    await expect(guestPage.getByText("Round 1, pick 1")).toBeVisible();
    await expect(guestPage.getByText("Reconnecting…")).toBeVisible();

    await guestContext.setOffline(false);
    await expect(guestPage.getByText("Round 1, pick 2")).toBeVisible({ timeout: 20_000 });
    await expect(guestPage.getByText("You're on the clock").first()).toBeVisible();
    await expect(guestPage.getByText("Reconnecting…")).toHaveCount(0);
    await guestContext.close();
  });

  test("only the commissioner sees draft controls", async ({ browser, request }) => {
    const league = await createDraftLeague(request, { seconds: 60, status: "in_progress" });
    const guestContext = await newUserContext(browser, league.guest.uid);
    const guestPage = await guestContext.newPage();
    await guestPage.goto(seasonUrl(league.league, "/draft"));
    await expect(guestPage.getByText("Round 1, pick 1")).toBeVisible();
    await expect(guestPage.getByRole("button", { name: "Commissioner controls" })).toHaveCount(0);
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
    await expect(page.getByText("Round 3, pick 1")).toBeVisible();

    await showPlayers(page);
    await page.getByRole("button", { name: "QB", exact: true }).click();
    const first = page.getByRole("list", { name: "Players" }).getByRole("listitem").first();
    await expect(
      first.getByText("You already have 2 QBs, the most your league allows"),
    ).toBeVisible();
    await expect(first.getByRole("button", { name: "Position full" })).toBeDisabled();
    if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/capped.png` });
  });
});

test.describe("commissioner draft setup", () => {
  test("randomizing and moving teams posts the order to the Feed", async ({
    page,
    context,
    request,
  }) => {
    const host = new Api(request, unique("host"));
    await host.signUp("host");
    const league = await host.createLeague(unique("Order League"));
    await signInAs(context, host.uid);
    const order = async () =>
      (await host.get<{ order: { teamId: number }[] }>(`/api/drafts/draft-info/${league.seasonId}`))
        .order;

    await page.goto(seasonUrl(league, "/draft"));
    await openControls(page);
    await page.getByRole("button", { name: "Randomize draft order" }).click();
    await expect.poll(async () => (await order()).length).toBe(2);
    const randomized = (await order()).map((slot) => slot.teamId);

    await page.getByRole("button", { name: "Edit draft order" }).click();
    const list = page.getByRole("list", { name: "Draft order" });
    await list
      .getByRole("button", { name: /^Move .* down$/ })
      .first()
      .click();
    await page.getByRole("button", { name: "Save order" }).click();
    await expect
      .poll(async () => (await order()).map((slot) => slot.teamId))
      .toEqual([...randomized].reverse());

    const feed = await host.get<{ items: { type: string; kind?: string }[] }>(
      `/api/seasons/${league.seasonId}/feed`,
    );
    const kinds = feed.items.map((item) => item.kind);
    expect(kinds).toContain("draft_order_randomized");
    expect(kinds).toContain("draft_order_changed");
  });

  test("seconds per pick are saved with the draft settings", async ({ page, context, request }) => {
    const host = new Api(request, unique("host"));
    await host.signUp("host");
    const league = await host.createLeague(unique("Clock League"));
    await signInAs(context, host.uid);

    await page.goto(seasonUrl(league, "/draft"));
    await openControls(page);
    await page.getByRole("button", { name: "Draft settings" }).click();
    await page.getByLabel("Seconds per pick").fill("45");
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect
      .poll(
        async () =>
          (
            await host.get<{ timePerPickSeconds: number }>(
              `/api/drafts/draft-info/${league.seasonId}`,
            )
          ).timePerPickSeconds,
      )
      .toBe(45);
  });

  test("the draft date is set from Change date and shown in the bar", async ({
    page,
    context,
    request,
  }) => {
    const host = new Api(request, unique("host"));
    await host.signUp("host");
    const league = await host.createLeague(unique("Date League"));
    await signInAs(context, host.uid);

    await page.goto(seasonUrl(league, "/draft"));
    await expect(page.getByText("Draft not scheduled yet")).toBeVisible();
    await openControls(page);
    await page.getByRole("button", { name: "Change date" }).click();
    const soon = new Date(Date.now() + 2 * 24 * 3600_000);
    const pad = (n: number) => String(n).padStart(2, "0");
    await page
      .getByLabel("Draft date & time")
      .fill(`${soon.getFullYear()}-${pad(soon.getMonth() + 1)}-${pad(soon.getDate())}T19:00`);
    await page.getByRole("button", { name: "Save date" }).click();
    await expect(page.getByText(/^Draft scheduled for /)).toBeVisible();
  });
});
