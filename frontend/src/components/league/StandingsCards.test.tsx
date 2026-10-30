import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { StandingsRow } from "../../api/types";
import StandingsCards from "./StandingsCards";

const useTeam = vi.fn();
vi.mock("../../api/queries", () => ({ useTeam: (id: unknown) => useTeam(id) }));

const row: StandingsRow = {
  teamId: 4,
  rank: 1,
  teamName: "Alpha",
  owner: "ann",
  playersLeft: 7,
  wildCard: 10,
  divisional: 20,
  confChamp: 0,
  superBowl: 0,
  total: 30,
};

const renderCards = () =>
  render(
    <MemoryRouter>
      <StandingsCards rows={[row]} />
    </MemoryRouter>,
  );

describe("StandingsCards", () => {
  it("shows rank, team, points and players alive collapsed", () => {
    renderCards();
    const toggle = screen.getByRole("button", { name: /Alpha/ });
    expect(toggle.textContent).toContain("1");
    expect(toggle.textContent).toContain("7 alive");
    expect(toggle.textContent).toContain("30");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText(/Divisional 20/)).toBeNull();
  });

  it("expands to the round breakdown and eliminated players", () => {
    useTeam.mockReturnValue({
      data: {
        roster: [
          { id: 1, name: "Out Guy", position: "WR", teamAbv: "DAL", isActive: false },
          { id: 2, name: "Alive Guy", position: "QB", teamAbv: "KC", isActive: true },
        ],
      },
    });
    renderCards();
    fireEvent.click(screen.getByRole("button", { name: /Alpha/ }));
    expect(screen.getByText("Divisional 20")).toBeTruthy();
    expect(screen.getByText(/Out Guy/)).toBeTruthy();
    expect(screen.queryByText(/Alive Guy/)).toBeNull();
  });
});
