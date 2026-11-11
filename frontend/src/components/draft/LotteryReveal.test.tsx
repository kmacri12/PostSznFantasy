import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DraftSlot } from "../../api/types";
import LotteryReveal from "./LotteryReveal";
import { byPick, isRevealed, REVEAL_STEP_MS } from "./lottery";

const slot = (position: number, teamName: string): DraftSlot => ({
  slot: position,
  teamId: position,
  teamName,
  ownerName: null,
  ownerUserId: null,
});
const order = [slot(2, "Bravo"), slot(1, "Alpha"), slot(3, "Charlie")];

describe("lottery helpers", () => {
  it("lists by pick and reveals from the last pick up", () => {
    expect(byPick(order).map((s) => s.teamName)).toEqual(["Alpha", "Bravo", "Charlie"]);
    expect([0, 1, 2, 3].map((n) => [1, 2, 3].filter((p) => isRevealed(p, 3, n)))).toEqual([
      [],
      [3],
      [2, 3],
      [1, 2, 3],
    ]);
  });
});

describe("LotteryReveal", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("shows the last pick first and the first pick last, then offers Done", () => {
    const onClose = vi.fn();
    render(<LotteryReveal order={order} onClose={onClose} />);
    expect(screen.queryByText("Charlie")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Skip" })).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(REVEAL_STEP_MS));
    expect(screen.getByText("Charlie")).toBeInTheDocument();
    expect(screen.queryByText("Bravo")).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(REVEAL_STEP_MS));
    expect(screen.getByText("Bravo")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(REVEAL_STEP_MS));
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("Skip reveals every team at once", () => {
    render(<LotteryReveal order={order} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    for (const name of ["Alpha", "Bravo", "Charlie"]) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
  });
});
