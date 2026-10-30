import { expect, test } from "@playwright/test";
import { signInAs } from "../support/auth";
import { completeDraft, createDraftLeague } from "../support/draft";

const draftedLeague = async (request: Parameters<typeof createDraftLeague>[0]) => {
  const league = await createDraftLeague(request, { seconds: 60, status: "in_progress" });
  await completeDraft(league);
  return league;
};

test.describe("team page", () => {
  test("a drafted roster fills the starter slots and the bench", async ({
    page,
    context,
    request,
  }) => {
    const league = await draftedLeague(request);
    await signInAs(context, league.host.uid);
    await page.goto(`/team/${league.hostTeamId}`);

    await expect(page.getByText("4 of 4 alive")).toBeVisible();
    await expect(page.getByRole("button", { name: /^QB Aiden Archer/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^RB Bryce Archer/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^WR Dante Archer/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^BN Caleb Archer/ })).toBeVisible();
  });

  test("tapping a bench player and then a starter slot swaps them, and it persists", async ({
    page,
    context,
    request,
  }) => {
    const league = await draftedLeague(request);
    await signInAs(context, league.host.uid);
    await page.goto(`/team/${league.hostTeamId}`);

    await page.getByRole("button", { name: /^BN Caleb Archer/ }).click();
    await page.getByRole("button", { name: /^RB Bryce Archer/ }).click();
    await expect(page.getByRole("button", { name: /^RB Caleb Archer/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^BN Bryce Archer/ })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("button", { name: /^RB Caleb Archer/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^BN Bryce Archer/ })).toBeVisible();
  });

  test("a player cannot start in a slot for another position", async ({
    page,
    context,
    request,
  }) => {
    const league = await draftedLeague(request);
    await signInAs(context, league.host.uid);
    await page.goto(`/team/${league.hostTeamId}`);

    await page.getByRole("button", { name: /^BN Caleb Archer/ }).click();
    await page.getByRole("button", { name: /^QB Aiden Archer/ }).click();
    await expect(page.getByRole("button", { name: /^QB Aiden Archer/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^BN Caleb Archer/ })).toBeVisible();
  });

  test("the owner renames the team", async ({ page, context, request }) => {
    const league = await draftedLeague(request);
    await signInAs(context, league.host.uid);
    await page.goto(`/team/${league.hostTeamId}`);

    await page.getByRole("button", { name: "Rename team" }).click();
    await page.getByLabel(/team name/i).fill("Sunday Survivors");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("heading", { name: "Sunday Survivors", level: 4 })).toBeVisible();
  });

  test("add/drop swaps a rostered player for a free agent when free agency is on", async ({
    page,
    context,
    request,
  }) => {
    const league = await draftedLeague(request);
    await league.host.patch(`/api/leagues/${league.leagueId}/settings`, {
      freeAgencyEnabled: true,
      freeAgencyWindow: "anytime",
    });
    await signInAs(context, league.host.uid);
    await page.goto(`/team/${league.hostTeamId}`);

    await page.getByRole("button", { name: "Add / drop" }).click();
    const dialog = page.getByRole("dialog", { name: "Add / drop" });
    await dialog.getByRole("combobox", { name: "Drop" }).click();
    await page.getByRole("option", { name: /Caleb Archer/ }).click();
    await dialog.getByRole("combobox", { name: "Add free agent" }).fill("Gavin Hale");
    await page.getByRole("option", { name: /Gavin Hale/ }).click();
    await expect(dialog.getByRole("alert")).toHaveCount(0);
    await dialog.getByRole("button", { name: "Confirm" }).click();

    await expect(page.getByRole("button", { name: /^BN Gavin Hale/ })).toBeVisible();
    await expect(page.getByText("Caleb Archer")).toHaveCount(0);
  });

  test("with free agency off, add/drop refuses to swap an active player", async ({
    page,
    context,
    request,
  }) => {
    const league = await draftedLeague(request);
    await signInAs(context, league.host.uid);
    await page.goto(`/team/${league.hostTeamId}`);

    await page.getByRole("button", { name: "Add / drop" }).click();
    const dialog = page.getByRole("dialog", { name: "Add / drop" });
    await dialog.getByRole("combobox", { name: "Drop" }).click();
    await page.getByRole("option", { name: /Caleb Archer/ }).click();
    await dialog.getByRole("combobox", { name: "Add free agent" }).fill("Gavin Hale");
    await page.getByRole("option", { name: /Gavin Hale/ }).click();

    await dialog.getByRole("button", { name: "Confirm" }).click();
    await expect(dialog.getByRole("alert")).toContainText("Free agency is off");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("button", { name: /^BN Caleb Archer/ })).toBeVisible();
  });

  test("another manager can look at the roster but not change it", async ({
    page,
    context,
    request,
  }) => {
    const league = await draftedLeague(request);
    await signInAs(context, league.guest.uid);
    await page.goto(`/team/${league.hostTeamId}`);

    await expect(page.getByRole("button", { name: /^QB Aiden Archer/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add / drop" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Rename team" })).toHaveCount(0);
  });
});
