import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { SeasonRecap as Recap } from "../../api/types";
import SeasonRecap from "./SeasonRecap";

vi.mock("../../api/queries", () => ({
  useRunItBack: () => ({ mutate: vi.fn(), isPending: false, error: null }),
}));

const recap: Recap = {
  leagueId: 1,
  season: 2025,
  finished: true,
  champions: [{ teamId: 1, teamName: "Gridiron Gang", owner: "kyle", total: 123.5 }],
  standings: { round: 4, gamesInProgress: 0, playersLeft: 0, teams: [] },
  nextLeagueId: null,
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

const show = (isCommissioner: boolean, nextLeagueId: number | null = null) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <SeasonRecap recap={recap} isCommissioner={isCommissioner} nextLeagueId={nextLeagueId} />
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

  it("offers run it back to commissioners only", () => {
    const { unmount } = show(false);
    expect(screen.queryByRole("button", { name: "Run it back" })).toBeNull();
    unmount();
    show(true);
    expect(screen.getByRole("button", { name: "Run it back" })).toBeTruthy();
  });

  it("links to next season once it has been run back", () => {
    show(true, 7);
    expect(screen.queryByRole("button", { name: "Run it back" })).toBeNull();
    expect(screen.getByRole("link", { name: /next season/ }).getAttribute("href")).toBe(
      "/league/7",
    );
  });
});
