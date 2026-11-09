import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { Api, type LeagueRef, seasonUrl, unique } from "../support/api";
import { signInAs } from "../support/auth";

// The screens of the first-run tour, captured from the real app (`make tour`, e2e/tour/run.mjs).
// The league is last season's real one: six managers, their 108 picks and each round's lineups
// (api/tests/fixtures/golden_2025), with the 14 real box scores replayed through the live poll.
// The tour's wording is in frontend/src/content/rules.ts (TOUR_STEPS); a step's id is its file.
const GOLDEN = path.resolve(import.meta.dirname, "../../api/tests/fixtures/golden_2025");
const OUT = path.resolve(import.meta.dirname, "../../frontend/public/tour");
const LEAGUE_NAME = "Playoff Pool";
const HOST = "KMac";

interface Snapshot {
  draftOrder: string[];
  draft: { pick: number; team: string; player: string }[];
  teams: { name: string; lineups: Record<string, { player: string | null }[]> }[];
}
const snapshot: Snapshot = JSON.parse(readFileSync(path.join(GOLDEN, "league_2025.json"), "utf8"));
const sheet: { name: string; pos: string; team: string; playerId: number | null }[] = JSON.parse(
  readFileSync(path.join(GOLDEN, "sheet_round_points.json"), "utf8"),
);
const boxes: Record<string, { gameWeek: string; homePts: string; awayPts: string }> = JSON.parse(
  readFileSync(path.join(GOLDEN, "box_scores.json"), "utf8"),
);

// "Puka Nacua (LAR) WR" is how the snapshot names a player; a defense is "LAR DST (LAR) DST".
const playerIds = new Map<string, number>();
for (const row of sheet) {
  if (row.playerId) playerIds.set(`${row.name} (${row.team}) ${row.pos}`, row.playerId);
}
const playerId = (label: string): number => {
  const found = playerIds.get(label);
  if (found) return found;
  const defense = /^(\w+) DST /.exec(label);
  if (defense) return -teamIdOf(defense[1]);
  throw new Error(`no player id for ${label}`);
};
// Defense ids are minus the NFL team id, which the replay's box scores carry.
const nflTeamIds: Record<string, number> = Object.fromEntries(
  JSON.parse(
    readFileSync(path.join(process.env.TOUR_FIXTURES_DIR ?? "", "nfl.json"), "utf8"),
  ).teams.map((team: { id: number; teamAbv: string }) => [team.teamAbv, team.id]),
);
const teamIdOf = (abv: string) => nflTeamIds[abv];

// Teams that lost a Wild Card game, to find the manager hit hardest in the next round.
const wildCardLosers = new Set(
  Object.entries(boxes)
    .filter(([, box]) => box.gameWeek === "Wild Card")
    .map(([id, box]) => {
      const [away, home] = id.split("_")[1].split("@");
      return Number(box.homePts) > Number(box.awayPts) ? away : home;
    }),
);
const lostOnNflTeam = (label: string | null) =>
  label !== null && wildCardLosers.has(/\((\w+)\)/.exec(label)?.[1] ?? "");

const shoot = (page: Page, id: string) =>
  page.screenshot({ path: path.join(OUT, `${id}.jpg`), type: "jpeg", quality: 82 });

interface StandingsView {
  gamesInProgress: number;
  gamesFinal: number;
  teams: { total: number }[];
}

test("tour captures", async ({ page, context, request }) => {
  test.setTimeout(900_000);
  await page.emulateMedia({ colorScheme: "dark" });

  const names = snapshot.draftOrder;
  const users = new Map(names.map((name) => [name, new Api(request, unique(name.toLowerCase()))]));
  for (const [name, user] of users) await user.signUp(name);
  const host = users.get(HOST) as Api;
  const { leagueId, seasonId } = await host.post<{ leagueId: number; seasonId: number }>(
    "/api/leagues/create-league",
    {
      leagueName: LEAGUE_NAME,
      scoringSettings: { scoringReceivingReception: 0.5 },
      teamUnitSettings: { teamQb: true, teamK: true },
    },
  );
  const league: LeagueRef = { leagueId, seasonId, year: 2026 };
  const code = await host.invite(league);
  await signInAs(context, host.uid, HOST);
  for (const [name, user] of users) if (name !== HOST) await user.joinWith(code);

  const teamIds = new Map<string, number>();
  for (const [name, user] of users) {
    const { myTeamId } = await user.get<{ myTeamId: number }>(`/api/seasons/${seasonId}`);
    teamIds.set(name, myTeamId);
    await user.patch(`/api/teams/${myTeamId}`, { name });
  }

  await host.put(`/api/drafts/${seasonId}/order`, {
    teamIds: names.map((name) => teamIds.get(name)),
  });
  await host.post(`/api/drafts/${seasonId}/control/lobby`);
  await host.post(`/api/drafts/${seasonId}/control/start`);

  for (const { pick, team, player } of snapshot.draft) {
    await (users.get(team) as Api).post(`/api/drafts/${seasonId}/picks`, {
      playerId: playerId(player),
    });
    if (pick === names.length * 3) {
      await page.goto(seasonUrl(league, "/draft"));
      await page.getByRole("tab", { name: "Board" }).click();
      await expect(page.getByTestId("pick-1")).toBeVisible();
      // The board scrolls itself to the pick on the clock; show it from the first round.
      await expect
        .poll(async () =>
          page.evaluate(() => {
            let moved = false;
            for (const element of document.querySelectorAll("*")) {
              if (element.scrollLeft || element.scrollTop) moved = true;
              element.scrollLeft = 0;
              element.scrollTop = 0;
            }
            return moved;
          }),
        )
        .toBe(false);
      await shoot(page, "draft");
    }
  }

  // The commissioner sets every round's lineup in advance, as the managers did on the sheet.
  for (const team of snapshot.teams) {
    for (const [round, rows] of Object.entries(team.lineups)) {
      for (const [slotIndex, row] of rows.entries()) {
        if (!row.player) continue;
        await host.post(`/api/teams/${teamIds.get(team.name)}/lineup`, {
          round: Number(round),
          playerId: playerId(row.player),
          slotIndex,
          confirmOverride: true,
        });
      }
    }
  }

  const chat: [string, string][] = [
    ["Ferg", "Puka at 1. Don't @ me."],
    ["Matt", "Stafford at 2, QB1 off the board before you all woke up"],
    ["Stearns", "Drake Maye at 3. Patriots are for real this year"],
    ["Slade", "Josh Allen at 4 is a steal and you all know it"],
    ["KMac", "JSN at 5. Seattle has the bye so I'm set for week one"],
    ["Craig", "Hurts then Saquon back to back. Eagles stack incoming"],
    ["Ferg", "Lineups lock at kickoff, set yours before Saturday!"],
  ];
  for (const [who, body] of chat) {
    await (users.get(who) as Api).post(`/api/seasons/${seasonId}/messages`, { body });
  }

  const standings = () => host.get<StandingsView>(`/api/seasons/${seasonId}/standings`);

  // Before kickoff, scrolled to the bench: the host's Seattle players have the bye.
  await page.goto(seasonUrl(league, `/teams/${teamIds.get(HOST)}`));
  await page.getByText("Bench", { exact: true }).evaluate((element) => element.scrollIntoView());
  await shoot(page, "wild-card");
  if (process.env.TOUR_STOP === "pre") return;

  // A game is live for about six seconds: wait for it, then open the screen.
  await expect
    .poll(
      async () => {
        const view = await standings();
        return view.gamesInProgress > 0 && view.teams.some((team) => team.total > 0);
      },
      { timeout: 400_000, intervals: [250] },
    )
    .toBe(true);
  // Each Wild Card loser is eliminated, so every one gone means the round is over.
  await expect
    .poll(
      async () => {
        const out = await host.get<{ teamAbv: string }[]>(
          "/api/players/player-list?isActive=false",
        );
        return new Set(out.map((player) => player.teamAbv)).size;
      },
      { timeout: 400_000, intervals: [500] },
    )
    .toBeGreaterThanOrEqual(wildCardLosers.size);

  // The manager with the most Divisional starters on a team that just lost.
  const hardestHit = snapshot.teams
    .map((team) => ({
      name: team.name,
      out: (team.lineups["2"] ?? []).filter((row) => lostOnNflTeam(row.player)).length,
    }))
    .sort((a, b) => b.out - a.out)[0];
  await page.goto(seasonUrl(league, `/teams/${teamIds.get(hardestHit.name)}`));
  await page.getByRole("tab", { name: "Divisional" }).click();
  const eliminated = page.getByRole("region", { name: "Eliminated" });
  await expect(eliminated).toBeVisible();
  // The page can still be settling, so scroll again until the group's end is on screen.
  await expect
    .poll(() =>
      eliminated.evaluate((element) => {
        element.scrollIntoView({ block: "end" });
        return element.getBoundingClientRect().bottom <= window.innerHeight;
      }),
    )
    .toBe(true);
  await shoot(page, "eliminated");

  await page.goto(seasonUrl(league));
  await expect(page.getByText(HOST).first()).toBeVisible();
  await shoot(page, "idea");
  await page.goto(seasonUrl(league, "/feed"));
  await expect(page.getByText("Lineups lock at kickoff")).toBeVisible();
  await shoot(page, "feed");

  await expect
    .poll(
      async () =>
        (await host.get<{ finished: boolean }>(`/api/seasons/${seasonId}/recap`)).finished,
      { timeout: 400_000, intervals: [1000] },
    )
    .toBe(true);
  await page.goto(seasonUrl(league));
  await expect(page.getByText(/champion/i).first()).toBeVisible();
  await shoot(page, "champion");
  await page.unrouteAll({ behavior: "wait" });
});
