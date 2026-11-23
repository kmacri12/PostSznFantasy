import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { RosterStatus } from "./lineupView";
import PlayersLeft, { gridColumns, gridWidth } from "./PlayersLeft";

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
  it("says how many are left and names every colour in its label", () => {
    render(<PlayersLeft status={status} layout="grid" />);
    expect(
      screen.getByRole("button", {
        name: "13 left, 4 advanced, 3 live, 6 to play, 2 eliminated",
      }),
    ).toBeInTheDocument();
  });

  it("opens the legend with the counts on a tap, and leaves out an empty status", () => {
    render(
      <PlayersLeft
        status={{
          ...status,
          statuses: ["advanced", "eliminated"],
          counts: { advanced: 1, live: 0, toPlay: 0, eliminated: 1 },
          left: 1,
        }}
        layout="row"
      />,
    );
    const button = screen.getByRole("button", { name: "1 left, 1 advanced, 1 eliminated" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    const legend = screen.getByRole("note");
    expect(legend).toHaveTextContent("1 advanced");
    expect(legend).toHaveTextContent("1 eliminated");
    expect(legend).not.toHaveTextContent("live");
  });

  it("lays 15 players out as 8 and 7", () => {
    expect(gridColumns(15)).toBe(8);
    expect(gridColumns(6)).toBe(4);
    expect(gridColumns(40)).toBe(10);
    expect(gridWidth(15)).toBe(8 * 12 - 3 + 8);
  });
});
