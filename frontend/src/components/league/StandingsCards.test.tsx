import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { StandingsRow } from "../../api/types";
import { SeasonContext } from "../../contexts/SeasonContext";
import { testSeason } from "../../test/season";
import StandingsCards from "./StandingsCards";

const season = testSeason();

const row = (teamId: number, rank: number, extra: Partial<StandingsRow> = {}): StandingsRow => ({
  teamId,
  rank,
  teamName: `Team ${teamId}`,
  owner: "ann",
  playersLeft: 7,
  wildCard: 10,
  divisional: 20,
  confChamp: 0,
  superBowl: 0,
  total: 30,
  tieReason: null,
  progress: { finished: 3, live: 2, toPlay: 1, notPlaying: 3 },
  ...extra,
});

const tied = [
  row(1, 1, {
    tieReason: {
      rule: "round_score",
      round: 2,
      overTeamId: 2,
      overTeamName: "Team 2",
      aheadValue: 20,
      behindValue: 10,
      detail: "higher Divisional score (20 to 10)",
      message: "Ahead of Team 2 on the tiebreaker: higher Divisional score (20 to 10)",
    },
  }),
  row(2, 2),
  row(3, 3, { total: 5 }),
];

const renderCards = (rows: StandingsRow[]) =>
  render(
    <MemoryRouter>
      <SeasonContext.Provider value={season}>
        <StandingsCards rows={rows} round={2} />
      </SeasonContext.Provider>
    </MemoryRouter>,
  );

describe("StandingsCards", () => {
  it("shows rank, team and total in the collapsed row, and nothing else", () => {
    renderCards([row(4, 1)]);
    const toggle = screen.getByRole("button", { name: /Team 4/ });
    expect(toggle.textContent).toContain("Team 4");
    expect(toggle.textContent).toContain("30");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.queryByText(/Players left/)).toBeNull();
    expect(screen.queryByLabelText("Starters this round")).toBeNull();
  });

  it("expands to rounds, players left and the live counts with their words", () => {
    renderCards([row(4, 1)]);
    fireEvent.click(screen.getByRole("button", { name: /Team 4/ }));

    expect(screen.getByRole("button", { name: /Team 4/ }).getAttribute("aria-expanded")).toBe(
      "true",
    );
    expect(screen.getByText("Divisional").nextSibling?.textContent).toBe("20");
    expect(screen.getByText(/Players left/).textContent).toContain("7");
    const counts = within(screen.getByLabelText("Starters this round")).getAllByRole("listitem");
    expect(counts.map((item) => item.getAttribute("aria-label"))).toEqual([
      "Finished: 3",
      "Live: 2",
      "To play: 1",
      "Not playing: 3",
    ]);
    expect(screen.getByRole("link", { name: "Round-by-round points" }).getAttribute("href")).toBe(
      "/leagues/3/seasons/2025/teams/4/points",
    );
  });

  it("marks teams that share a rank", () => {
    renderCards([row(1, 1), row(2, 1), row(3, 3)]);
    expect(screen.getAllByText("T1")).toHaveLength(2);
    expect(screen.getByText("3")).toBeTruthy();
  });

  it("explains a tie in a tooltip on the team above and on the team below", async () => {
    renderCards(tied);

    const above = screen.getByRole("button", { name: /^Rank 1\./ });
    fireEvent.mouseOver(above);
    expect((await screen.findByRole("tooltip")).textContent).toBe(
      "Ahead of Team 2 on the tiebreaker: higher Divisional score (20 to 10)",
    );
    fireEvent.mouseOut(above);

    const below = screen.getByRole("button", { name: /^Rank 2\./ });
    expect(below.getAttribute("aria-label")).toContain(
      "Behind Team 1 on the tiebreaker: higher Divisional score (20 to 10)",
    );
    // Decided by points, not a tie: the rank is plain text.
    expect(screen.queryByRole("button", { name: /^Rank 3/ })).toBeNull();
  });

  it("repeats the tie reason as text inside the expanded card", () => {
    renderCards(tied);
    fireEvent.click(screen.getByRole("button", { name: /^Team 1/ }));
    expect(
      screen.getByText("Ahead of Team 2 on the tiebreaker: higher Divisional score (20 to 10)"),
    ).toBeTruthy();
  });
});
