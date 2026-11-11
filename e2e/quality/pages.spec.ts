import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { Api, type LeagueRef, seasonUrl, unique } from "../support/api";
import { signInAs } from "../support/auth";
import { completeDraft, createDraftLeague } from "../support/draft";
import { KNOWN_VIOLATIONS } from "./knownViolations";

// Nightly: a screenshot and an axe scan of each key page, per theme, per device project.
// Everything is seeded with fixed names so the baselines stay comparable run to run.

interface Seat {
  league: LeagueRef;
  /** The commissioner, who is signed in for the pages of this league. */
  uid: string;
}

interface Seeded {
  /** A league that has not drafted: invite and open slot. */
  fresh: Seat;
  /** A league whose draft room is open, nobody picking yet. */
  lobby: Seat;
  /** A league whose draft is complete: standings, teams, feed. */
  drafted: Seat;
  teamId: number;
}

let seeded: Seeded;

test.beforeAll(async ({ playwright }) => {
  const request = await playwright.request.newContext();
  const fresh = new Api(request, unique("quality-fresh"));
  await fresh.signUp("Fresh");
  const freshLeague = await fresh.createLeague("Fresh League");
  await fresh.invite(freshLeague);

  const lobby = await createDraftLeague(request, {
    status: "lobby",
    hostUid: unique("quality-lobby"),
    leagueName: "Lobby League",
  });
  const drafted = await createDraftLeague(request, {
    seconds: 60,
    status: "in_progress",
    hostUid: unique("quality-drafted"),
    leagueName: "Draft League",
  });
  await completeDraft(drafted);
  await drafted.host.post(`/api/seasons/${drafted.league.seasonId}/messages`, {
    body: "Good luck everyone.",
  });
  seeded = {
    fresh: { league: freshLeague, uid: fresh.uid },
    lobby: { league: lobby.league, uid: lobby.host.uid },
    drafted: { league: drafted.league, uid: drafted.host.uid },
    teamId: drafted.hostTeamId,
  };
  await request.dispose();
});

interface Shot {
  name: string;
  /** The league whose commissioner is signed in; null is the signed-out visitor. */
  league: "fresh" | "lobby" | "drafted" | null;
  path: (s: Seeded) => string;
  /** Text that proves the page has loaded before it is photographed. */
  ready: (page: Page) => Promise<void>;
}

const heading = (name: string | RegExp) => async (page: Page) => {
  await expect(page.getByRole("heading", { name }).first()).toBeVisible(); // any match proves the page rendered
};

const SHOTS: Shot[] = [
  { name: "landing", league: null, path: () => "/", ready: heading(/playoffs only/i) },
  {
    name: "home",
    league: "drafted",
    path: () => "/",
    ready: async (page) => {
      await expect(page.getByText("Draft League", { exact: true })).toBeVisible();
    },
  },
  {
    name: "league-before-draft",
    league: "fresh",
    path: (s) => seasonUrl(s.fresh.league),
    ready: async (page) => {
      await expect(page.getByText("Open slot", { exact: true })).toBeVisible();
    },
  },
  {
    name: "draft-room",
    league: "lobby",
    path: (s) => seasonUrl(s.lobby.league, "/draft"),
    ready: async (page) => {
      await expect(page.getByRole("region", { name: "Draft clock" })).toBeVisible();
    },
  },
  {
    name: "league-after-draft",
    league: "drafted",
    path: (s) => seasonUrl(s.drafted.league),
    ready: async (page) => {
      await expect(page.getByRole("region", { name: "Standings" })).toBeVisible();
    },
  },
  {
    name: "team",
    league: "drafted",
    path: (s) => seasonUrl(s.drafted.league, `/teams/${s.teamId}`),
    ready: async (page) => {
      await expect(page.getByText("Starters", { exact: true })).toBeVisible();
    },
  },
  {
    name: "feed",
    league: "drafted",
    path: (s) => seasonUrl(s.drafted.league, "/feed"),
    ready: async (page) => {
      await expect(page.getByText("Good luck everyone.")).toBeVisible();
    },
  },
  {
    name: "more",
    league: "drafted",
    path: (s) => seasonUrl(s.drafted.league, "/more"),
    ready: async (page) => {
      await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
    },
  },
  {
    name: "settings",
    league: "drafted",
    path: (s) => seasonUrl(s.drafted.league, "/settings"),
    ready: heading(/settings/i),
  },
];

for (const theme of ["dark", "light"] as const) {
  test.describe(theme, () => {
    for (const shot of SHOTS) {
      test(`${shot.name}`, async ({ page, context }) => {
        await page.addInitScript((mode) => localStorage.setItem("postszn-theme", mode), theme);
        if (shot.league) await signInAs(context, seeded[shot.league].uid, "Quality Host");
        await page.goto(shot.path(seeded));
        await shot.ready(page);
        // Dark is the default and sets no attribute.
        if (theme === "light")
          await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
        else await expect(page.locator("html")).not.toHaveAttribute("data-theme", "light");

        const violations = (
          await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
        ).violations.filter(
          (v) =>
            !KNOWN_VIOLATIONS[v.id]?.pages.includes(`${shot.name}-${theme}`) &&
            v.impact !== "minor",
        );
        expect(
          violations.map((v) => ({
            rule: v.id,
            impact: v.impact,
            help: v.help,
            targets: v.nodes.slice(0, 3).map((n) => n.target.join(" ")),
          })),
          `axe violations on ${shot.name} (${theme})`,
        ).toEqual([]);

        await expect(page).toHaveScreenshot(`${shot.name}-${theme}.png`, {
          fullPage: true,
          // Relative times and clocks change every run.
          mask: [page.locator("time")],
        });
      });
    }
  });
}
