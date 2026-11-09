import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { Api, type LeagueRef, seasonUrl, unique } from "../support/api";
import { signInAs } from "../support/auth";

// The screens of the first-run tour, captured from the real app (`make tour`, e2e/tour/run.mjs).
// Each run replays one relabelled round; the screens a run owns are listed under `ROUND_SCREENS`.
// The tour's wording is in frontend/src/content/rules.ts (TOUR_STEPS); a step's id is its file.
const OUT = path.resolve(import.meta.dirname, "../../frontend/public/tour");
const round = process.env.TOUR_ROUND ?? "wild-card";
const ROUND_INDEX: Record<string, number> = { "wild-card": 1, conference: 3, "super-bowl": 4 };

const NAMES = ["Maya", "Jordan", "Sam", "Riley"];
// Player ids are team*100+slot+1 (e2e/fixtures): 1 QB, 2-3 RB, 4-5 WR, 6 TE. KCC, BAL, LAR and
// DET lose in the replay, so every manager loses someone.
const PICKS = [
  [101, 202, 504, 806, 402],
  [201, 302, 604, 506, 503],
  [401, 502, 204, 106, 303],
  [501, 802, 404, 706, 203],
];
const TEAM_NAMES = ["Gridiron Gang", "Blitz Brigade", "Sunday Scaries", "Hail Mary Club"];

const shoot = (page: Page, id: string) =>
  page.screenshot({ path: path.join(OUT, `${id}.jpg`), type: "jpeg", quality: 82 });

interface StandingsView {
  gamesInProgress: number;
  gamesFinal: number;
  teams: { total: number }[];
}

test(`tour captures: ${round}`, async ({ page, context, request }) => {
  test.setTimeout(240_000);
  await page.emulateMedia({ colorScheme: "dark" });

  const users = NAMES.map((name) => new Api(request, unique(name.toLowerCase())));
  for (const [index, user] of users.entries()) await user.signUp(NAMES[index]);
  const [host, ...others] = users;
  const league: LeagueRef = await host.createLeague("Sunday Squad", {
    numberTeams: 4,
    rosterTotal: 5,
    rosterNumQb: 1,
    rosterNumRb: 1,
    rosterNumWr: 1,
    rosterNumTe: 1,
    rosterNumBench: 1,
  });
  const code = await host.invite(league);
  const seasonId = league.seasonId;
  await signInAs(context, host.uid, NAMES[0]);

  // Everyone but the last manager joins first, so the league page shows an open slot.
  for (const other of others.slice(0, 2)) await other.joinWith(code);

  if (round === "wild-card") {
    await page.goto(seasonUrl(league));
    await expect(page.getByText("Invite your friends")).toBeVisible();
    await expect(page.getByText("Open slot", { exact: false }).first()).toBeVisible(); // any open slot row
    await shoot(page, "pre-draft");
  }
  await others[2].joinWith(code);

  const teamIds: number[] = [];
  for (const user of users) {
    teamIds.push((await user.get<{ myTeamId: number }>(`/api/seasons/${seasonId}`)).myTeamId);
  }
  for (const [index, teamId] of teamIds.entries()) {
    await users[index].patch(`/api/teams/${teamId}`, { name: TEAM_NAMES[index] });
  }

  await host.put(`/api/drafts/${seasonId}/order`, { teamIds });
  await host.patch(`/api/drafts/${seasonId}`, { timePerPickSeconds: 90 });
  await host.post(`/api/drafts/${seasonId}/control/lobby`);
  await host.post(`/api/drafts/${seasonId}/control/start`);

  const queues = PICKS.map((picks) => [...picks]);
  let picked = 0;
  for (;;) {
    const state = await host.get<{
      status: string;
      onTheClockTeamId: number | null;
    }>(`/api/drafts/draft-info/${seasonId}`);
    if (state.status === "completed") break;
    if (round === "wild-card" && picked === 6) {
      await page.goto(seasonUrl(league, "/draft"));
      await expect(page.getByRole("tab", { name: "Players" })).toBeVisible();
      await shoot(page, "draft");
      picked++;
    }
    const who = teamIds.indexOf(state.onTheClockTeamId ?? -1);
    const playerId = queues[who]?.shift();
    if (playerId === undefined) throw new Error("a manager ran out of planned picks");
    await users[who].post(`/api/drafts/${seasonId}/picks`, { playerId });
    picked++;
  }

  // Lineups for this run's round: QB, RB, WR, TE in slots 0-3, the fifth pick on the bench.
  // The host is a commissioner, so a lineup the replay clock already locked still moves.
  // The Wild Card run also fills the Divisional lineup, so the losers' empty slots show.
  const lineupRounds = round === "wild-card" ? [1, 2] : [ROUND_INDEX[round]];
  for (const [index, teamId] of teamIds.entries()) {
    for (const lineupRound of lineupRounds) {
      for (const [slotIndex, playerId] of PICKS[index].slice(0, 4).entries()) {
        await host.post(`/api/teams/${teamId}/lineup`, {
          round: lineupRound,
          playerId,
          slotIndex,
          confirmOverride: true,
        });
      }
    }
  }
  await host.post(`/api/seasons/${seasonId}/messages`, {
    body: "Draft is in the books. Good luck!",
  });
  await others[0].post(`/api/seasons/${seasonId}/messages`, {
    body: "Starting my QB, no matter what.",
  });

  const standings = () => host.get<StandingsView>(`/api/seasons/${seasonId}/standings`);
  const hostTeam = seasonUrl(league, `/teams/${teamIds[0]}`);

  // A game is live for about six seconds: wait for it, then open the screen.
  // ...and scoring: points show up a moment after kickoff, when the live poll has read the box.
  await expect
    .poll(
      async () => {
        const view = await standings();
        return view.gamesInProgress > 0 && view.teams.some((team) => team.total > 0);
      },
      { timeout: 120_000, intervals: [250] },
    )
    .toBe(true);
  const live = round === "conference" ? seasonUrl(league) : hostTeam;
  await page.goto(live);
  if (round === "super-bowl") await page.getByRole("tab", { name: "Super Bowl" }).click();
  await expect(page.getByText(/Live/).first()).toBeVisible();
  await shoot(
    page,
    { "wild-card": "wild-card", conference: "conference", "super-bowl": "super-bowl" }[round] ??
      round,
  );

  // Each replayed game knocks one NFL team out, so four eliminations means every game is final.
  await expect
    .poll(
      async () => {
        const out = await host.get<{ teamAbv: string }[]>(
          "/api/players/player-list?isActive=false",
        );
        return new Set(out.map((player) => player.teamAbv)).size;
      },
      { timeout: 120_000, intervals: [500] },
    )
    .toBeGreaterThanOrEqual(4);

  if (round === "wild-card") {
    await page.goto(hostTeam);
    await page.getByRole("tab", { name: "Divisional" }).click();
    const eliminated = page.getByRole("region", { name: "Eliminated" });
    await expect(eliminated).toBeVisible();
    await eliminated.evaluate((element) => element.scrollIntoView({ block: "center" }));
    await shoot(page, "divisional");
    await page.goto(seasonUrl(league));
    await expect(page.getByText("Gridiron Gang").first()).toBeVisible();
    await shoot(page, "idea");
  }
  if (round === "conference") {
    await page.goto(seasonUrl(league, "/feed"));
    await expect(page.getByText("Starting my QB")).toBeVisible();
    await shoot(page, "feed");
  }
  if (round === "super-bowl") {
    await page.goto(seasonUrl(league));
    await expect(page.getByText(/champion/i).first()).toBeVisible();
    await shoot(page, "champion");
    await page.getByRole("button", { name: /Start .* season/ }).scrollIntoViewIfNeeded();
    await shoot(page, "next-season");
  }
  await page.unrouteAll({ behavior: "wait" });
});
