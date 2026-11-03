import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { SeasonRecap as Recap } from "../../api/types";
import SeasonRecap from "./SeasonRecap";

vi.mock("../../api/queries", () => ({
  useStartSeason: () => ({ mutate: vi.fn(), isPending: false, error: null }),
}));

const recap: Recap = {
  seasonId: 1,
  leagueId: 1,
  year: 2025,
  finished: true,
  champions: [{ teamId: 1, teamName: "Gridiron Gang", owner: "kyle", total: 123.5 }],
  standings: { round: 4, gamesInProgress: 0, playersLeft: 0, teams: [] },
  nextSeasonId: null,
  awards: [
    {
      key: "playoff_mvp",
      title: "Playoff MVP",
      teamId: 1,
      teamName: "Gridiron Gang",
      owner: "kyle",
      playerId: 9,
      playerName: "Josh Allen",
      position: "QB",
      round: null,
      value: 61.2,
      draftedAs: null,
      finishedAs: null,
      points: null,
    },
    {
      key: "bust_wr",
      title: "Biggest WR bust",
      teamId: 1,
      teamName: "Gridiron Gang",
      owner: "kyle",
      playerId: 10,
      playerName: "Pick One",
      position: "WR",
      round: null,
      value: -24,
      draftedAs: 6,
      finishedAs: 30,
      points: 0,
    },
  ],
};

const show = (canStartSeason: boolean, nextSeasonId: number | null = null) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <SeasonRecap recap={{ ...recap, nextSeasonId }} canStartSeason={canStartSeason} />
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe("SeasonRecap", () => {
  it("crowns the champion and lists the awards", () => {
    show(false);
    expect(screen.getByText("Gridiron Gang", { selector: "h4" })).toBeTruthy();
    expect(screen.getByText(/Josh Allen/)).toBeTruthy();
    expect(screen.getByText(/Drafted as WR6, finished WR30, -24 places/)).toBeTruthy();
  });

  it("offers to start the next season only when the caller may", () => {
    const { unmount } = show(false);
    expect(screen.queryByRole("button", { name: "Start 2026 season" })).toBeNull();
    unmount();
    show(true);
    expect(screen.getByText("Season over: start 2026")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Start 2026 season" })).toBeTruthy();
  });

  it("links to the next season once it has been started", () => {
    show(false, 7);
    expect(screen.queryByRole("button", { name: "Start 2026 season" })).toBeNull();
    expect(screen.getByRole("link", { name: /2026 season/ }).getAttribute("href")).toBe(
      "/leagues/1",
    );
  });
});
