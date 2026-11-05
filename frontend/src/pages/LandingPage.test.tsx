import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LeagueByUser, PastLeague } from "../api/types";
import LandingPage from "./LandingPage";

const mocks = vi.hoisted(() => ({
  user: { user: null as unknown, userId: null as number | null, loading: false, syncError: null },
  leagues: { data: undefined as unknown[] | undefined, isError: false },
  past: [] as unknown[],
  navigate: vi.fn(),
}));

vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => mocks.navigate,
}));
vi.mock("../contexts/UserContext", () => ({ useUser: () => mocks.user }));
vi.mock("../api/queries", () => ({
  useUserLeagues: () => ({ ...mocks.leagues, error: null, refetch: vi.fn() }),
  usePastLeagues: () => ({ data: mocks.past }),
  useStandings: () => ({
    isLoading: false,
    data: {
      phase: "live",
      round: 3,
      gamesInProgress: 0,
      teams: [
        { teamId: 1, rank: 1, owner: "A", total: 80, teamName: "A" },
        { teamId: 2, rank: 2, owner: "Me", total: 71.64, teamName: "Mine" },
      ],
    },
  }),
  useDraft: () => ({ data: { startTime: null } }),
}));

const league = (overrides: Partial<LeagueByUser> = {}): LeagueByUser => ({
  id: 3,
  name: "Gridiron",
  seasonId: 6,
  season: 2026,
  isCommissioner: true,
  userTeamId: 2,
  hasNewActivity: false,
  finished: false,
  draftStatus: "completed",
  seasons: [],
  ...overrides,
});

const renderLanding = (props: { dormant?: boolean } = {}) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <LandingPage {...props} />
      </MemoryRouter>
    </QueryClientProvider>,
  );

const signedIn = () => {
  mocks.user = { user: { id: "u" }, userId: 5, loading: false, syncError: null };
};

beforeEach(() => {
  mocks.user = { user: null, userId: null, loading: false, syncError: null };
  mocks.leagues = { data: [], isError: false };
  mocks.past = [];
  mocks.navigate.mockReset();
});

describe("LandingPage signed out", () => {
  it("shows the hero with Sign in and How to play, and the legal footer", () => {
    renderLanding();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/playoffs/);
    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/sign-in");
    expect(screen.getByRole("link", { name: "How to play" }).getAttribute("href")).toBe(
      "/how-to-play",
    );
    expect(screen.getByRole("link", { name: "Privacy" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Terms" })).toBeTruthy();
  });

  it("replaces the hero with the off-season notice when dormant", () => {
    renderLanding({ dormant: true });
    expect(screen.queryByRole("link", { name: "Sign in" })).toBeNull();
    expect(screen.getByRole("link", { name: "Privacy" })).toBeTruthy();
  });
});

describe("LandingPage signed in", () => {
  beforeEach(signedIn);

  it("never redirects: the logo can always reach the leagues page", () => {
    mocks.leagues = { data: [league()], isError: false };
    renderLanding();
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: /Gridiron/ }).getAttribute("href")).toBe("/leagues/3");
  });

  it("puts league cards first with phase, rank, points and the feed dot", () => {
    mocks.leagues = { data: [league({ hasNewActivity: true })], isError: false };
    renderLanding();
    expect(screen.getByText("Conference Championship")).toBeTruthy();
    expect(screen.getByText("2nd")).toBeTruthy();
    expect(screen.getByText("of 2 teams")).toBeTruthy();
    expect(screen.getByText("71.6")).toBeTruthy();
    expect(screen.getByRole("img", { name: "New activity" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Create a league" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Invite code" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Read how to play" })).toBeTruthy();
  });

  it("offers only Create and Join when there are no leagues", () => {
    renderLanding();
    expect(screen.getByRole("link", { name: "Create a league" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Join" })).toBeTruthy();
    expect(screen.queryByRole("img", { name: "New activity" })).toBeNull();
  });

  it("opens an invite from the code box", () => {
    renderLanding();
    fireEvent.change(screen.getByRole("textbox", { name: "Invite code" }), {
      target: { value: " ab12 " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Join" }));
    expect(mocks.navigate).toHaveBeenCalledWith("/join/AB12");
  });

  it("waits for the leagues before deciding", () => {
    mocks.leagues = { data: undefined, isError: false };
    renderLanding();
    expect(screen.queryByRole("link", { name: "Create a league" })).toBeNull();
  });

  it("lists leagues the member left with the seasons they can still read", () => {
    mocks.past = [
      {
        id: 8,
        name: "Old Crew",
        seasons: [
          {
            id: 2,
            year: 2024,
            finished: true,
            current: false,
            draftStatus: "completed",
            myTeamId: 1,
          },
        ],
      } satisfies PastLeague,
    ];
    renderLanding();
    expect(screen.getByText("Leagues you left")).toBeTruthy();
    expect(screen.getByRole("link", { name: "2024" }).getAttribute("href")).toBe(
      "/leagues/8/seasons/2024",
    );
  });
});
