import type { APIRequestContext, Browser, BrowserContext, Page } from "@playwright/test";
import { test } from "@playwright/test";
import { Api, type LeagueRef, type RosterShape, unique } from "./api";
import { signInAs } from "./auth";

export interface DraftState {
  status: string;
  order: number[];
  picks: { teamId: number; playerId: number; autopick: boolean }[];
  onTheClockTeamId: number | null;
  currentPickOverall: number | null;
  totalPicks: number;
  pausedRemainingSeconds: number | null;
}

export interface DraftLeague {
  host: Api;
  guest: Api;
  league: LeagueRef;
  code: string;
  hostTeamId: number;
  guestTeamId: number;
  state: () => Promise<DraftState>;
}

/** A two-team league with both managers seated and the draft order saved (host first). */
export const createDraftLeague = async (
  request: APIRequestContext,
  options: {
    seconds?: number;
    roster?: RosterShape;
    status?: "unscheduled" | "lobby" | "in_progress";
    hostUid?: string;
    /** Defaults to a unique name; the screenshot suite needs one that never changes. */
    leagueName?: string;
  } = {},
): Promise<DraftLeague> => {
  const host = new Api(request, options.hostUid ?? unique("host"));
  const guest = new Api(request, unique("guest"));
  await host.signUp("host");
  await guest.signUp("guest");
  const league = await host.createLeague(
    options.leagueName ?? unique("Draft League"),
    options.roster,
  );
  const code = await host.invite(league);
  await guest.joinWith(code);

  const info = await host.get<{ unassignedTeamIds: number[] }>(
    `/api/drafts/draft-info/${league.seasonId}`,
  );
  const hostTeam = (await host.get<{ myTeamId: number }>(`/api/seasons/${league.seasonId}`))
    .myTeamId;
  const guestTeam = (await guest.get<{ myTeamId: number }>(`/api/seasons/${league.seasonId}`))
    .myTeamId;
  expectSeated(info.unassignedTeamIds.length === 2);
  await host.put(`/api/drafts/${league.seasonId}/order`, { teamIds: [hostTeam, guestTeam] });
  if (options.seconds)
    await host.patch(`/api/drafts/${league.seasonId}`, { timePerPickSeconds: options.seconds });
  const status = options.status ?? "unscheduled";
  if (status !== "unscheduled") await host.post(`/api/drafts/${league.seasonId}/control/lobby`);
  if (status === "in_progress") await host.post(`/api/drafts/${league.seasonId}/control/start`);

  return {
    host,
    guest,
    league,
    code,
    hostTeamId: hostTeam,
    guestTeamId: guestTeam,
    state: () => host.get<DraftState>(`/api/drafts/draft-info/${league.seasonId}`),
  };
};

const expectSeated = (ok: boolean) => {
  if (!ok) throw new Error("expected two unassigned teams in a fresh league");
};

/** A second signed-in browser, configured like the project's device (viewport, touch). */
export const newUserContext = async (browser: Browser, uid: string): Promise<BrowserContext> => {
  const context = await browser.newContext(test.info().project.use);
  await signInAs(context, uid);
  return context;
};

/** Remember every WebSocket so a test can drop the connection like a flaky network would. */
export const trackSockets = (context: BrowserContext) =>
  context.addInitScript(() => {
    const sockets: WebSocket[] = [];
    (window as unknown as { __sockets: WebSocket[] }).__sockets = sockets;
    const Native = window.WebSocket;
    window.WebSocket = class extends Native {
      constructor(url: string | URL, protocols?: string | string[]) {
        super(url, protocols);
        sockets.push(this);
      }
    } as typeof WebSocket;
  });

export const dropSockets = (page: Page) =>
  page.evaluate(() =>
    (window as unknown as { __sockets: WebSocket[] }).__sockets.forEach((socket) => {
      socket.close();
    }),
  );

/** Opens the commissioner strip when it is closed. */
export const openControls = async (page: Page) => {
  const toggle = page.getByRole("button", { name: "Commissioner controls" });
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
};

/** The draft room shows every view at once from this width (the `lg` breakpoint) up. */
const TWO_PANE_WIDTH = 1200;

/** Shows one draft room view (a tab on phones, always on screen on wide screens). */
export const showView = async (page: Page, view: "Players" | "Board" | "Roster" | "Queue") => {
  if ((page.viewportSize()?.width ?? 0) < TWO_PANE_WIDTH)
    await page.getByRole("tab", { name: view }).click();
};

export const showPlayers = (page: Page) => showView(page, "Players");

/** Drafts the first available player at `position` through the Players view (tap, then confirm). */
export const draftFirst = async (page: Page, position: string): Promise<string> => {
  await showPlayers(page);
  await page.getByRole("button", { name: position, exact: true }).click();
  // The list is sorted by points from fixed fixtures, so the top row is the same on every run.
  const row = page.getByRole("list", { name: "Players" }).getByRole("listitem").first();
  // A player row's first paragraph is the player's name.
  const name = (await row.locator("p").first().textContent()) ?? "";
  await row.getByRole("button", { name: `Draft ${name}`, exact: true }).click();
  await row.getByRole("button", { name: `Confirm ${name}`, exact: true }).click();
  return name;
};

export interface DraftPlan {
  host: number[];
  guest: number[];
}

/** Player ids are team*100+slot+1 (see fixtures): 1 QB, 2-3 RB, 4-5 WR, 6 TE, 7 K, 8 DST. */
export const DEFAULT_PLAN: DraftPlan = {
  host: [101, 102, 104, 103],
  guest: [201, 202, 204, 203],
};

/** Finishes a started draft over REST, each manager picking from their plan in turn. */
export const completeDraft = async (league: DraftLeague, plan: DraftPlan = DEFAULT_PLAN) => {
  const queues = { host: [...plan.host], guest: [...plan.guest] };
  for (;;) {
    const state = await league.state();
    if (state.status === "completed") return;
    const who = state.onTheClockTeamId === league.hostTeamId ? "host" : "guest";
    const playerId = queues[who].shift();
    if (playerId === undefined) throw new Error(`${who} ran out of planned picks`);
    await league[who].post(`/api/drafts/${league.league.seasonId}/picks`, { playerId });
  }
};
