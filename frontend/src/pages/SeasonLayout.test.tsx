import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSeasonContext } from "../contexts/SeasonContext";
import { testSeason } from "../test/season";
import SeasonLayout from "./SeasonLayout";

const mocks = vi.hoisted(() => ({
  seasons: { data: undefined as unknown, isLoading: false, isError: false, error: null },
  season: { data: undefined as unknown, isLoading: false, isError: false, error: null },
  requested: [] as unknown[],
}));

vi.mock("../api/queries", () => ({
  useLeagueSeasons: () => ({ ...mocks.seasons, refetch: vi.fn() }),
  useSeason: (id: unknown) => {
    mocks.requested.push(id);
    return { ...mocks.season, refetch: vi.fn() };
  },
}));

const Page = () => {
  const { seasonId, paths } = useSeasonContext();
  return <div>{`season ${seasonId} at ${paths.draft}`}</div>;
};

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/leagues/:leagueId/seasons/:year" element={<SeasonLayout />}>
          <Route index element={<Page />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  mocks.requested = [];
  mocks.seasons = {
    data: [
      { id: 5, year: 2025, finished: true, draftStatus: "completed", myTeamId: 1 },
      { id: 9, year: 2026, finished: false, draftStatus: "unscheduled", myTeamId: null },
    ],
    isLoading: false,
    isError: false,
    error: null,
  };
  mocks.season = { data: testSeason().season, isLoading: false, isError: false, error: null };
});

describe("SeasonLayout", () => {
  it("opens the season for the year in the URL and hands its paths to the page", () => {
    renderAt("/leagues/3/seasons/2025");
    expect(screen.getByText("season 5 at /leagues/3/seasons/2025/draft")).toBeInTheDocument();
    expect(mocks.requested).toContain(5);
  });

  it("says so when the league has no season that year", () => {
    renderAt("/leagues/3/seasons/2031");
    expect(screen.getByText("The 2031 season not found")).toBeInTheDocument();
    expect(mocks.requested).not.toContain(undefined);
  });
});
