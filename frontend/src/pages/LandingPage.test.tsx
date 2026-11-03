import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LeagueByUser, PastLeague, SeasonSummary } from "../api/types";
import LandingPage from "./LandingPage";

const mocks = vi.hoisted(() => ({
  past: [] as unknown[],
  startMutate: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => mocks.navigate,
}));
vi.mock("../contexts/UserContext", () => ({
  useUser: () => ({ user: { id: "u" }, signIn: vi.fn() }),
}));
vi.mock("../api/queries", () => ({
  useStandings: () => ({ isLoading: false, isError: false, data: { teams: [] } }),
  useDraft: () => ({ isLoading: false, data: { status: "completed", startTime: null } }),
  usePastLeagues: () => ({ data: mocks.past }),
  useStartSeason: () => ({ mutate: mocks.startMutate, isPending: false, error: null }),
}));

const season = (id: number, year: number, finished: boolean): SeasonSummary => ({
  id,
  year,
  finished,
  current: false,
  draftStatus: "completed",
  myTeamId: null,
});

const league = (overrides: Partial<LeagueByUser> = {}): LeagueByUser => ({
  id: 3,
  name: "Gridiron",
  seasonId: 6,
  season: 2026,
  isCommissioner: true,
  userTeamId: null,
  hasNewActivity: false,
  finished: false,
  draftStatus: "in_progress",
  seasons: [season(5, 2025, true), season(6, 2026, false)],
  ...overrides,
});

const renderLanding = (leagues: LeagueByUser[]) =>
  render(
    <MemoryRouter>
      <LandingPage leagues={leagues} />
    </MemoryRouter>,
  );

beforeEach(() => {
  mocks.past = [];
  mocks.startMutate.mockReset();
  mocks.navigate.mockReset();
});

describe("LandingPage league list", () => {
  it("lists each league once with its earlier seasons under Past seasons", () => {
    renderLanding([league()]);
    expect(screen.getAllByText("Gridiron")).toHaveLength(1);
    const past = screen.getByText("Past seasons").parentElement as HTMLElement;
    expect(within(past).getByRole("link", { name: "2025" }).getAttribute("href")).toBe(
      "/leagues/3/seasons/2025",
    );
    expect(within(past).queryByRole("link", { name: "2026" })).toBeNull();
  });

  it("lets the commissioner start the next season once this one is over", () => {
    mocks.startMutate.mockImplementation((_, options) => options.onSuccess());
    renderLanding([league({ finished: true })]);
    expect(screen.getByText("Season over: start 2027")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Start 2027 season" }));
    expect(mocks.navigate).toHaveBeenCalledWith("/leagues/3");
  });

  it("tells a member their commissioner starts it", () => {
    renderLanding([league({ finished: true, isCommissioner: false })]);
    expect(screen.queryByRole("button", { name: "Start 2027 season" })).toBeNull();
    expect(screen.getByText("Your commissioner starts the 2027 season.")).toBeInTheDocument();
  });

  it("shows leagues the member left with the seasons they can still read", () => {
    mocks.past = [
      { id: 8, name: "Old Crew", seasons: [season(2, 2024, true)] } satisfies PastLeague,
    ];
    renderLanding([]);
    expect(screen.getByText("Leagues you left")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "2024" }).getAttribute("href")).toBe(
      "/leagues/8/seasons/2024",
    );
  });
});
