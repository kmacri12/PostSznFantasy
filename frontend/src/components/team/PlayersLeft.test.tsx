import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { RosterStatus } from "./lineupView";
import PlayersLeft from "./PlayersLeft";

const status: RosterStatus = {
  round: 1,
  statuses: [
    ...Array(4).fill("advanced"),
    ...Array(3).fill("live"),
    ...Array(6).fill("toPlay"),
    ...Array(2).fill("eliminated"),
  ],
  counts: { advanced: 4, live: 3, toPlay: 6, eliminated: 2 },
  left: 13,
};

describe("players left", () => {
  it("says how many players are left and names every colour in its label", () => {
    render(<PlayersLeft status={status} />);
    const button = screen.getByRole("button", {
      name: "13 players left, 4 advanced, 3 live, 6 yet to play, 2 eliminated",
    });
    expect(button).toHaveTextContent("13 players left");
  });

  it("opens the breakdown on a tap: all four statuses with their counts, eliminated first", () => {
    render(
      <PlayersLeft
        status={{
          ...status,
          statuses: ["advanced", "eliminated"],
          counts: { advanced: 1, live: 0, toPlay: 0, eliminated: 1 },
          left: 1,
        }}
      />,
    );
    const button = screen.getByRole("button", {
      name: "1 player left, 1 advanced, 1 eliminated",
    });
    expect(button).toHaveTextContent("1 player left");
    expect(button).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    const lines = Array.from(screen.getByRole("note").children).map((line) => line.textContent);
    expect(lines).toEqual(["1 eliminated", "0 live", "0 yet to play", "1 advanced"]);
  });
});
