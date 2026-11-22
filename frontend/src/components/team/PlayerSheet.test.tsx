import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { lineupPlayer, roundLineup, slot } from "../../test/lineup";
import PlayerSheet from "./PlayerSheet";

vi.mock("../../api/queries", () => ({
  usePlayerSeasonLine: () => ({
    isPending: false,
    data: {
      season: "2025",
      playerId: 3,
      receivingReceptions: 108,
      receivingYards: 1282,
      receivingTouchdowns: 10,
    },
  }),
}));

const diggs = lineupPlayer({ id: 2, name: "Stefon Diggs", position: "WR", teamAbv: "HOU" });
const brian = lineupPlayer({ id: 3, name: "Brian Thomas Jr.", position: "WR", teamAbv: "JAX" });
const cook = lineupPlayer({ id: 4, name: "James Cook", position: "RB", locked: true });

const lineup = roundLineup(2, {
  slots: [slot(0, "WR", diggs), slot(1, "FLEX"), slot(2, "FLEX", cook), slot(3, "BENCH", brian)],
});

const sheet = (props: Partial<Parameters<typeof PlayerSheet>[0]> = {}) => {
  const onMove = vi.fn();
  render(
    <PlayerSheet
      player={brian}
      lineup={lineup}
      lineups={[lineup]}
      canMove
      canOverride={false}
      ownTeam
      pending={false}
      error={null}
      onMove={onMove}
      onClose={vi.fn()}
      {...props}
    />,
  );
  return onMove;
};

describe("PlayerSheet", () => {
  it("always has a Close button", () => {
    const onClose = vi.fn();
    sheet({ onClose });
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("heads the sheet with the player's position, team, place in the lineup and round", () => {
    sheet();
    expect(screen.getByRole("heading", { name: "Brian Thomas Jr." })).toBeInTheDocument();
    expect(screen.getByText("WR · JAX · bench · Divisional")).toBeInTheDocument();
  });

  it("shows the regular season line for his position", () => {
    sheet();
    expect(screen.getByText("2025 regular season")).toBeInTheDocument();
    expect(screen.getByText("108 rec · 1,282 yds · 10 TD")).toBeInTheDocument();
  });

  it("offers swaps and starts, and a tap makes the move", () => {
    const onMove = sheet();
    expect(screen.getByText("Move in your lineup")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Start at FLEX/ }));
    expect(onMove).toHaveBeenCalledWith({ playerId: 3, slotIndex: 1 });
  });

  it("greys out a swap with a locked starter and says why", () => {
    sheet();
    const locked = screen.getByRole("button", { name: /James Cook/ });
    expect(locked).toBeDisabled();
    expect(locked).toHaveTextContent("game started, locked");
  });

  it("shows no moves on a team the viewer cannot edit", () => {
    sheet({ canMove: false });
    expect(screen.queryByText(/Move in/)).toBeNull();
  });

  it("says it is a commissioner's move on someone else's lineup", () => {
    sheet({ ownTeam: false, canOverride: true });
    expect(screen.getByText("Move in this lineup")).toBeInTheDocument();
  });

  it("shows the round's live line once the game has started", () => {
    sheet({
      player: {
        ...brian,
        gameState: "live",
        gameClock: "Q3 8:42",
        statLine: "5 rec, 74 yds",
        points: 13.4,
      },
    });
    const thisGame = screen.getByRole("region", { name: "This game" });
    expect(thisGame).toHaveTextContent("Divisional5 rec, 74 yds");
    expect(thisGame).toHaveTextContent("Fantasy points13.4");
    expect(screen.getByText("Q3 8:42")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Postseason" })).toBeNull();
  });

  it("shows how this game's points were made, with the round multiplier", () => {
    sheet({
      lineup: { ...lineup, multiplier: 1.5 },
      player: {
        ...brian,
        gameState: "final",
        statLine: "5 rec, 74 yds",
        points: 18.6,
        pointsBreakdown: [
          { label: "5 receptions", points: 5 },
          { label: "74 receiving yards", points: 7.4 },
        ],
      },
    });
    const rows = [...screen.getByRole("region", { name: "This game" }).querySelectorAll("b")].map(
      (cell) => `${cell.previousSibling?.textContent} = ${cell.textContent}`,
    );
    expect(rows).toEqual([
      "Divisional = 5 rec, 74 yds",
      "5 receptions = 5.0",
      "74 receiving yards = 7.4",
      "Subtotal = 12.4",
      "Divisional multiplier = ×1.5",
      "Fantasy points = 18.6",
    ]);
  });

  it("lists earlier postseason games apart from this game and the regular season", () => {
    const wildCard = roundLineup(1, {
      slots: [
        slot(
          3,
          "BENCH",
          lineupPlayer({ ...brian, gameState: "final", statLine: "6 rec, 81 yds", points: 11.1 }),
        ),
      ],
    });
    sheet({ lineups: [lineup, wildCard] });
    const sections = screen
      .getAllByRole("region")
      .map((region) => region.getAttribute("aria-label"));
    expect(sections).toEqual(["Postseason", "2025 regular season"]);
    expect(screen.getByRole("region", { name: "Postseason" })).toHaveTextContent(
      "Wild Card11.1 pts6 rec, 81 yds",
    );
  });
});
