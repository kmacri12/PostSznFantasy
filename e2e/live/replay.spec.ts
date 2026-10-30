import { expect, type Page, test } from "@playwright/test";
import { Api } from "../support/api";
import { signInAs } from "../support/auth";
import { completeDraft, createDraftLeague, type DraftLeague } from "../support/draft";

// Fixture schedule (e2e/fixtures/build_fixtures.py): the home side wins games 1 and 3, the
// away side games 2 and 4, so teams are knocked out in this order, one per finished game.
const ELIMINATION_ORDER = ["KCC", "BAL", "LAR", "DET"];

const eliminatedTeams = async (api: Api): Promise<string[]> => {
  const players = await api.get<{ teamAbv: string }[]>("/api/players/player-list?is_active=false");
  return [...new Set(players.map((player) => player.teamAbv))].sort();
};

const waitForEliminations = async (api: Api, count: number) => {
  await expect
    .poll(async () => (await eliminatedTeams(api)).length, {
      timeout: 60_000,
      intervals: [200],
      message: `waiting for ${count} eliminated team(s)`,
    })
    .toBeGreaterThanOrEqual(count);
};

let main: DraftLeague;
let swap: DraftLeague;

test.beforeAll(async ({ request }) => {
  test.setTimeout(60_000);
  const plan = (host: number[], guest: number[]) => ({ host, guest });
  // Host owns KCC, BAL, LAR and SFO players; guest owns BUF, HOU, PHI and DET players.
  main = await createDraftLeague(request, { seconds: 60, status: "in_progress" });
  await completeDraft(main, plan([101, 302, 604, 802], [201, 402, 504, 702]));
  swap = await createDraftLeague(request, { seconds: 60, status: "in_progress" });
  await completeDraft(swap, plan([101, 302, 604, 802], [201, 402, 504, 702]));
});

// Host roster: QB Aiden Archer (KCC), RB Bryce Cole (BAL), WR Dante Frost (LAR), bench SFO.
const HOST_ROWS = ["QB Aiden Archer", "RB Bryce Cole", "WR Dante Frost"];
const row = (page: Page, player: string, status: "Alive" | "Eliminated") =>
  page.getByRole("button", { name: new RegExp(`^${player}.*${status}$`) });

test("eliminations reach the team pages as each replayed game finishes", async ({
  page,
  context,
  request,
}) => {
  const watcher = new Api(request, main.host.uid);
  await signInAs(context, main.host.uid);

  await test.step("before the first kickoff nobody is out", async () => {
    expect(await eliminatedTeams(watcher)).toEqual([]);
    await page.goto(`/team/${main.hostTeamId}`);
    await expect(page.getByText("4 of 4 alive")).toBeVisible();
    for (const player of HOST_ROWS) await expect(row(page, player, "Alive")).toBeVisible();
  });

  for (const [index, team] of ELIMINATION_ORDER.entries()) {
    await test.step(`${team} loses and is eliminated`, async () => {
      await waitForEliminations(watcher, index + 1);
      expect(await eliminatedTeams(watcher)).toEqual(ELIMINATION_ORDER.slice(0, index + 1).sort());

      // The host loses a player for each of the first three eliminations; DET is the guest's.
      const alive = 4 - Math.min(index + 1, 3);
      await page.goto(`/team/${main.hostTeamId}`);
      await expect(page.getByText(`${alive} of 4 alive`)).toBeVisible();
      await expect(page.getByText(/Stats updated/)).toBeVisible();
      if (index < 3) {
        await expect(row(page, HOST_ROWS[index], "Eliminated")).toBeVisible();
      }
    });
  }

  await test.step("the guest's roster only lost the last team's player", async () => {
    await page.goto(`/team/${main.guestTeamId}`);
    await expect(page.getByText("3 of 4 alive")).toBeVisible();
    await expect(row(page, "BN Bryce Grady", "Eliminated")).toBeVisible();
  });
});

test("an eliminated player can be swapped for a free agent even with free agency off", async ({
  page,
  context,
  request,
}) => {
  const watcher = new Api(request, swap.host.uid);
  await waitForEliminations(watcher, 1);
  await signInAs(context, swap.host.uid);
  await page.goto(`/team/${swap.hostTeamId}`);
  await expect(row(page, "QB Aiden Archer", "Eliminated")).toBeVisible();

  await page.getByRole("button", { name: "Add / drop" }).click();
  const dialog = page.getByRole("dialog", { name: "Add / drop" });
  await dialog.getByRole("combobox", { name: "Drop" }).click();
  await page.getByRole("option", { name: /Aiden Archer/ }).click();
  await dialog.getByRole("combobox", { name: "Add free agent" }).fill("Aiden Hale");
  await page.getByRole("option", { name: /Aiden Hale/ }).click();
  await dialog.getByRole("button", { name: "Confirm" }).click();

  await expect(row(page, "QB Aiden Hale", "Alive")).toBeVisible();
  await expect(page.getByText("Aiden Archer")).toHaveCount(0);
});

interface StandingsRow {
  teamId: number;
  rank: number;
  playersLeft: number;
  total: number;
}

const standingsOf = (api: Api, league: DraftLeague) =>
  api.get<StandingsRow[]>(`/api/leagues/${league.leagueId}/standings`);

test("standings follow the replay: players left drop and points accrue", async ({
  page,
  context,
  request,
}) => {
  const host = new Api(request, main.host.uid);
  const hostRow = async () =>
    (await standingsOf(host, main)).find((row) => row.teamId === main.hostTeamId);

  // Eliminations and standings commit together, so once n teams are out the host's
  // count is at or below what n eliminations leave (the replay may already be further on).
  // The host loses a player per elimination until DET, the guest's, goes out last.
  for (const [index, left] of [3, 2, 1, 1].entries()) {
    await waitForEliminations(host, index + 1);
    expect((await hostRow())?.playersLeft).toBeLessThanOrEqual(left);
  }
  await expect.poll(async () => (await hostRow())?.playersLeft).toBe(1);

  const rows = await standingsOf(host, main);
  expect(rows).toHaveLength(2);
  expect(rows.map((row) => row.rank)).toEqual([1, 2]);
  expect(rows[0].total).toBeGreaterThanOrEqual(rows[1].total);
  expect(rows[0].total).toBeGreaterThan(0);
  expect(rows.find((row) => row.teamId === main.guestTeamId)?.playersLeft).toBe(3);

  await signInAs(context, host.uid);
  await page.goto(`/league/${main.leagueId}`);
  await expect(page.getByRole("heading", { name: "No standings yet" })).toHaveCount(0);
  await expect(page.getByRole("list", { name: "Standings" }).getByRole("listitem")).toHaveCount(2);
});
