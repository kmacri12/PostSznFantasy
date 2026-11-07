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
  test("a drafted roster starts on the bench in every round, with a banner for the owner", async ({
    page,
    context,
    request,
  }) => {
    const league = await draftedLeague(request);
    await signInAs(context, league.host.uid);
    await page.goto(seasonUrl(league.league, `/teams/${league.hostTeamId}`));

    await expect(page.getByRole("heading", { name: /Team|Archer/, level: 1 })).toBeVisible();
    await expect(page.getByText(/^You/)).toBeVisible();
    await expect(page.getByRole("tab")).toHaveCount(4);
    await expect(page.getByRole("alert")).toContainText("empty starter slots");

    const starters = page.getByRole("region", { name: "Starters" });
    await expect(starters.getByText("Empty")).toHaveCount(3);
    const bench = page.getByRole("region", { name: "Bench" });
    await expect(bench.getByRole("button", { name: /^QB Aiden Archer/ })).toBeVisible();
    await expect(bench.getByRole("listitem")).toHaveCount(4);
  });

  test("starting a player from his sheet moves him in that round only, and it persists", async ({
    page,
    context,
    request,
  }) => {
    const league = await draftedLeague(request);
    await signInAs(context, league.host.uid);
    await page.goto(seasonUrl(league.league, `/teams/${league.hostTeamId}`));

    await page.getByRole("button", { name: /^RB Bryce Archer/ }).click();
    await expect(page.getByText("Move in your lineup")).toBeVisible();
    await expect(page.getByRole("button", { name: /Start at QB/ })).toHaveCount(0);
    await page.getByRole("button", { name: /Start at RB/ }).click();
    await expect(page.getByRole("heading", { name: "Bryce Archer" })).toHaveCount(0);

    const starters = page.getByRole("region", { name: "Starters" });
    await expect(starters.getByRole("button", { name: /^RB Bryce Archer/ })).toBeVisible();

    await page.reload();
    await expect(
      page
        .getByRole("region", { name: "Starters" })
        .getByRole("button", { name: /^RB Bryce Archer/ }),
    ).toBeVisible();
    await page.getByRole("tab", { name: "Super Bowl" }).click();
    await expect(
      page.getByRole("region", { name: "Bench" }).getByRole("button", { name: /^RB Bryce Archer/ }),
    ).toBeVisible();
  });

  test("a starter can be benched from his sheet", async ({ page, context, request }) => {
    const league = await draftedLeague(request);
    await signInAs(context, league.host.uid);
    await page.goto(seasonUrl(league.league, `/teams/${league.hostTeamId}`));

    await page.getByRole("button", { name: /^QB Aiden Archer/ }).click();
    await page.getByRole("button", { name: /Start at QB/ }).click();
    await page.getByRole("button", { name: /^QB Aiden Archer/ }).click();
    await page.getByRole("button", { name: /Move to bench/ }).click();
    await expect(
      page.getByRole("region", { name: "Bench" }).getByRole("button", { name: /^QB Aiden Archer/ }),
    ).toBeVisible();
  });

  test("the owner renames the team", async ({ page, context, request }) => {
    const league = await draftedLeague(request);
    await signInAs(context, league.host.uid);
    await page.goto(seasonUrl(league.league, `/teams/${league.hostTeamId}`));

    await page.getByRole("button", { name: "Team settings" }).click();
    await page.getByRole("button", { name: /^Team name/ }).click();
    await page.getByRole("textbox", { name: "Team name" }).fill("Sunday Survivors");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    const sheet = page.getByRole("dialog", { name: "Team settings" });
    await expect(sheet.getByRole("button", { name: /^Team name/ })).toContainText(
      "Sunday Survivors",
    );
    await sheet.getByRole("button", { name: "Done" }).click();
    await expect(page.getByRole("heading", { name: "Sunday Survivors", level: 1 })).toBeVisible();
  });

  test("another manager can open a player's sheet but not move anyone", async ({
    page,
    context,
    request,
  }) => {
    const league = await draftedLeague(request);
    await signInAs(context, league.guest.uid);
    await page.goto(seasonUrl(league.league, `/teams/${league.hostTeamId}`));

    await expect(page.getByRole("alert")).toHaveCount(0);
    await page.getByRole("button", { name: "Team settings" }).click();
    const sheet = page.getByRole("dialog", { name: "Team settings" });
    await expect(sheet.getByText("Owner")).toBeVisible();
    await expect(sheet.getByRole("button", { name: /^Team name/ })).toHaveCount(0);
    await sheet.getByRole("button", { name: "Done" }).click();
    await page.getByRole("button", { name: /^QB Aiden Archer/ }).click();
    await expect(page.getByRole("heading", { name: "Aiden Archer" })).toBeVisible();
    await expect(page.getByText(/Move in/)).toHaveCount(0);
  });
});
