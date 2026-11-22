import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api/client";
import { resetTeamLogosForTests } from "../../api/teamLogos";
import { lineupPlayer } from "../../test/lineup";
import PlayerRow from "./PlayerRow";

vi.mock("../../api/client", () => ({ api: { get: vi.fn() } }));

const baker = lineupPlayer({
  name: "Baker Mayfield",
  teamAbv: "TB",
  gameState: "live",
  gameClock: "Q2 6:56",
  points: 1.24,
  pointsBreakdown: [
    { label: "21 passing yards", points: 0.84 },
    { label: "4 rushing yards", points: 0.4 },
  ],
});

const renderRow = (player = baker, multiplier = 1) =>
  render(
    <MemoryRouter>
      <ul>
        <PlayerRow label="QB" player={player} onOpen={vi.fn()} scoring={{ round: 1, multiplier }} />
      </ul>
    </MemoryRouter>,
  );

beforeEach(() => {
  resetTeamLogosForTests();
  vi.mocked(api.get).mockResolvedValue({ data: { TB: "https://a.espncdn.com/tb.png" } });
  window.matchMedia = ((query: string) => ({
    matches: true,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
});

describe("a lineup row", () => {
  it("shows the NFL team's logo beside the abbreviation", async () => {
    const { container } = renderRow();
    await vi.waitFor(() =>
      expect(container.querySelector('img[src="https://a.espncdn.com/tb.png"]')).not.toBeNull(),
    );
    expect(screen.getByText(/Baker Mayfield ·/)).toHaveTextContent("Baker Mayfield · TB");
  });
});

describe("the score's breakdown", () => {
  it("opens from the points with a line per scoring stat and the total", () => {
    renderRow();
    fireEvent.click(screen.getByRole("button", { name: /^1\.24 points, how they were scored/ }));
    const sheet = screen.getByRole("dialog", { name: "Baker Mayfield · Wild Card" });
    const terms = within(sheet)
      .getAllByRole("term")
      .map((term) => term.textContent);
    const values = within(sheet)
      .getAllByRole("definition")
      .map((value) => value.textContent);
    expect(terms).toEqual(["21 passing yards", "4 rushing yards", "Total"]);
    expect(values).toEqual(["0.84", "0.4", "1.24"]);
  });

  it("shows the round multiplier between the lines and the total", () => {
    renderRow({ ...baker, points: 1.86 }, 1.5);
    fireEvent.click(screen.getByRole("button", { name: /how they were scored/ }));
    const sheet = screen.getByRole("dialog", { name: "Baker Mayfield · Wild Card" });
    expect(
      within(sheet)
        .getAllByRole("term")
        .map((term) => term.textContent),
    ).toEqual(["21 passing yards", "4 rushing yards", "Subtotal", "Wild Card multiplier", "Total"]);
    expect(within(sheet).getByText("×1.5")).toBeInTheDocument();
  });

  it("is not a button before the player has scored anything", () => {
    renderRow({ ...baker, points: null, pointsBreakdown: [] });
    expect(screen.queryByRole("button", { name: /how they were scored/ })).toBeNull();
  });
});
