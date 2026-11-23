import { fireEvent, render, screen } from "@testing-library/react";
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
  pointsBreakdown: [{ label: "21 passing yards", points: 0.84 }],
});

beforeEach(() => {
  resetTeamLogosForTests();
  vi.mocked(api.get).mockResolvedValue({ data: { TB: "https://a.espncdn.com/tb.png" } });
});

describe("a lineup row", () => {
  it("shows the NFL team's logo beside the abbreviation", async () => {
    const { container } = render(
      <ul>
        <PlayerRow label="QB" player={baker} onOpen={vi.fn()} />
      </ul>,
    );
    await vi.waitFor(() =>
      expect(container.querySelector('img[src="https://a.espncdn.com/tb.png"]')).not.toBeNull(),
    );
    expect(screen.getByText(/Baker Mayfield ·/)).toHaveTextContent("Baker Mayfield · TB");
  });

  it("opens the player sheet, which holds the breakdown; the points are not a button", () => {
    const onOpen = vi.fn();
    render(
      <ul>
        <PlayerRow label="QB" player={baker} onOpen={onOpen} />
      </ul>,
    );
    expect(screen.queryByRole("button", { name: /how they were scored/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^QB Baker Mayfield/ }));
    expect(onOpen).toHaveBeenCalledWith(baker);
  });

  it("opens the same sheet when the score itself is tapped", () => {
    const onOpen = vi.fn();
    render(
      <ul>
        <PlayerRow label="QB" player={baker} onOpen={onOpen} />
      </ul>,
    );
    fireEvent.click(screen.getByText("1.24"));
    expect(onOpen).toHaveBeenCalledWith(baker);
  });

  it("opens the sheet from the cell around a changed score, but not from its explanation", () => {
    const onOpen = vi.fn();
    const corrected = lineupPlayer({
      name: "Baker Mayfield",
      points: 1.24,
      scoreChange: { previousPoints: 1, newPoints: 1.24, changedAt: "2026-01-12T00:00:00Z" },
    });
    render(
      <ul>
        <PlayerRow label="QB" player={corrected} onOpen={onOpen} />
      </ul>,
    );
    fireEvent.click(screen.getByRole("button", { name: /score changed/ }));
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("an empty row's dash opens the picker like the rest of the row", () => {
    const onFillEmpty = vi.fn();
    render(
      <ul>
        <PlayerRow label="FLEX" player={null} onOpen={vi.fn()} onFillEmpty={onFillEmpty} />
      </ul>,
    );
    fireEvent.click(screen.getByText("-"));
    expect(onFillEmpty).toHaveBeenCalled();
  });
});
