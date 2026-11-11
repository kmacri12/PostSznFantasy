import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Bracket, BracketGame, BracketTeam } from "../../api/types";
import BracketView from "./BracketView";

const team = (id: number, abbreviation: string): BracketTeam => ({
  id,
  abbreviation,
  city: abbreviation,
  name: `${abbreviation} Team`,
  logoUrl: null,
  topPlayers: [{ id: id * 10, name: `${abbreviation} Star`, position: "QB", points: 301.5 }],
});

const wildCard: BracketGame = {
  id: "wc",
  kickoff: null,
  state: "final",
  clock: null,
  home: team(1, "KC"),
  away: team(2, "BUF"),
  homePoints: 27,
  awayPoints: 24,
  winnerTeamId: 1,
  myPlayers: [{ id: 10, name: "KC Star", position: "QB", teamId: 1, role: "starter" }],
};

const bracket: Bracket = {
  year: 2025,
  currentRound: 2,
  byes: [team(3, "HOU")],
  rounds: [
    { round: 1, games: [wildCard] },
    { round: 2, games: [] },
    { round: 3, games: [] },
    { round: 4, games: [] },
  ],
};

describe("BracketView", () => {
  it("lists the rounds, the final score, the byes and what each empty round waits for", () => {
    render(<BracketView bracket={bracket} />);
    expect(screen.getByRole("heading", { name: "Wild Card" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Divisional · now" })).toBeInTheDocument();
    expect(screen.getByText("Bye: HOU")).toBeInTheDocument();
    expect(screen.getAllByText("Set once the previous round is final.")).toHaveLength(3);
    const card = screen.getByRole("button", { name: /BUF at KC, Final/ });
    expect(within(card).getByText("27")).toBeInTheDocument();
    expect(within(card).getByText("Yours: 1 starter")).toBeInTheDocument();
  });

  it("opens a game to show my players and each team's top players", () => {
    render(<BracketView bracket={bracket} />);
    fireEvent.click(screen.getByRole("button", { name: /BUF at KC/ }));
    const sheet = screen.getByRole("dialog", { name: "BUF at KC" });
    expect(within(sheet).getByText("Starter")).toBeInTheDocument();
    expect(within(sheet).getByText("BUF Star")).toBeInTheDocument();
    expect(within(sheet).getAllByText("301.5 pts")).toHaveLength(2);
  });

  it("says so when none of my players are in the game", () => {
    render(
      <BracketView
        bracket={{
          ...bracket,
          rounds: [
            { round: 1, games: [{ ...wildCard, myPlayers: [] }] },
            ...bracket.rounds.slice(1),
          ],
        }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /BUF at KC/ }));
    expect(screen.getByText(/once you have drafted/)).toBeInTheDocument();
  });
});
