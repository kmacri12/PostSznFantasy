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
  it("opens on the current round and says what that empty round waits for", () => {
    render(<BracketView bracket={bracket} />);
    expect(screen.getByRole("tab", { name: /Divisional/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText("Set once the previous round is final.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /BUF at KC/ })).not.toBeInTheDocument();
  });

  it("shows only the picked round: its games and score, and the byes under Wild Card", () => {
    render(<BracketView bracket={bracket} />);
    fireEvent.click(screen.getByRole("tab", { name: /Wild Card/ }));
    expect(screen.getByRole("tab", { name: /Wild Card/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Bye: HOU")).toBeInTheDocument();
    const card = screen.getByRole("button", { name: /BUF at KC, Final/ });
    expect(within(card).getByText("27")).toBeInTheDocument();
    expect(within(card).getByText("Yours: 1 starter")).toBeInTheDocument();
    expect(screen.queryByText("Set once the previous round is final.")).not.toBeInTheDocument();
  });
});
