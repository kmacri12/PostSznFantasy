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
    const locked = screen.getByRole("button", { name: /Swap with James Cook/ });
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
        gameClock: "8:42",
        statLine: "5 rec, 74 yds",
        points: 13.4,
      },
    });
    expect(screen.getByText("This round")).toBeInTheDocument();
    expect(screen.getByText("5 rec, 74 yds")).toBeInTheDocument();
    expect(screen.getByText("Live 8:42")).toBeInTheDocument();
  });
});
