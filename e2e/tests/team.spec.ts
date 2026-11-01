import { expect, test } from "@playwright/test";
import { seasonUrl } from "../support/api";
import { signInAs } from "../support/auth";
import { completeDraft, createDraftLeague } from "../support/draft";

const draftedLeague = async (request: Parameters<typeof createDraftLeague>[0]) => {
  const league = await createDraftLeague(request, { seconds: 60, status: "in_progress" });
  await completeDraft(league);
  return league;
};

test.describe("team page", () => {
  test("a drafted roster starts unassigned in every round, with a banner for the owner", async ({
    page,
    context,
    request,
  }) => {
    const league = await draftedLeague(request);
    await signInAs(context, league.host.uid);
    await page.goto(seasonUrl(league.league, `/teams/${league.hostTeamId}`));

    await expect(page.getByText("4 of 4 alive")).toBeVisible();
    await expect(page.getByRole("alert")).toContainText("empty starter slots");
    for (const slot of [0, 1, 2]) {
      await expect(page.getByTestId(`slot-${slot}`)).toContainText("Empty");
    }
    await expect(page.getByRole("button", { name: /^QB Aiden Archer/ })).toBeVisible();
    await expect(page.getByText("Not in this lineup")).toBeVisible();
  });

  test("tapping a player and then a slot starts them in that round only, and it persists", async ({
    page,
    context,
    request,
  }) => {
    const league = await draftedLeague(request);
    await signInAs(context, league.host.uid);
    await page.goto(seasonUrl(league.league, `/teams/${league.hostTeamId}`));

    await page.getByRole("button", { name: /^RB Bryce Archer/ }).click();
    await page.getByTestId("slot-1").click();
    await expect(page.getByTestId("slot-1")).toContainText("Bryce Archer");

    await page.reload();
    await expect(page.getByTestId("slot-1")).toContainText("Bryce Archer");
    await page.getByRole("tab", { name: "Super Bowl" }).click();
    await expect(page.getByTestId("slot-1")).toContainText("Empty");
  });

  test("a player cannot start in a slot for another position", async ({
    page,
    context,
    request,
  }) => {
    const league = await draftedLeague(request);
    await signInAs(context, league.host.uid);
    await page.goto(seasonUrl(league.league, `/teams/${league.hostTeamId}`));

    await page.getByRole("button", { name: /^RB Bryce Archer/ }).click();
    await page.getByTestId("slot-0").click();
    await expect(page.getByRole("alert").last()).toContainText("can't play");
    await expect(page.getByTestId("slot-0")).toContainText("Empty");
  });

  test("the owner renames the team", async ({ page, context, request }) => {
    const league = await draftedLeague(request);
    await signInAs(context, league.host.uid);
    await page.goto(seasonUrl(league.league, `/teams/${league.hostTeamId}`));

    await page.getByRole("button", { name: "Rename team" }).click();
    await page.getByLabel(/team name/i).fill("Sunday Survivors");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("heading", { name: "Sunday Survivors", level: 4 })).toBeVisible();
  });

  test("another manager can look at the roster but not change it", async ({
    page,
    context,
    request,
  }) => {
    const league = await draftedLeague(request);
    await signInAs(context, league.guest.uid);
    await page.goto(seasonUrl(league.league, `/teams/${league.hostTeamId}`));

    await expect(page.getByRole("button", { name: /^QB Aiden Archer/ })).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Rename team" })).toHaveCount(0);
  });
});
