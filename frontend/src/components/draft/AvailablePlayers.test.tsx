import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PlayerSummary } from "../../api/types";
import AvailablePlayers from "./AvailablePlayers";

const player = (id: number, name: string) =>
  ({ id, name, position: "QB", teamAbv: "KC" }) as PlayerSummary;
const players = [player(1, "Pat Mahomes"), player(2, "Josh Allen")];

const renderList = (overrides: Partial<Parameters<typeof AvailablePlayers>[0]> = {}) => {
  const onPick = vi.fn();
  render(
    <AvailablePlayers
      players={players}
      draftedIds={new Set()}
      cappedPositions={{}}
      queue={[]}
      canPick
      isConnected
      pendingPlayerId={null}
      onPick={onPick}
      onQueue={vi.fn()}
      {...overrides}
    />,
  );
  return onPick;
};

describe("AvailablePlayers pick submission", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("does not submit on a single tap; the second tap confirms", () => {
    const onPick = renderList();
    fireEvent.click(screen.getAllByRole("button", { name: "Draft" })[0] as HTMLElement);
    expect(onPick).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Confirm Pat Mahomes" }));
    expect(onPick).toHaveBeenCalledWith(players[0]);
  });

  it("disarms after about 3 seconds so a stray tap never submits", () => {
    const onPick = renderList();
    fireEvent.click(screen.getAllByRole("button", { name: "Draft" })[0] as HTMLElement);
    act(() => vi.advanceTimersByTime(3100));
    expect(screen.queryByRole("button", { name: /Confirm/ })).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: "Draft" })[0] as HTMLElement);
    expect(onPick).not.toHaveBeenCalled();
  });

  it("disables drafting with a reconnecting label while the socket is down", () => {
    renderList({ isConnected: false });
    const [first] = screen.getAllByRole("button", { name: "Reconnecting…" });
    expect(first).toBeDisabled();
  });

  it("shows a pending state on the submitted player and blocks other drafts", () => {
    renderList({ pendingPlayerId: 1 });
    expect(screen.getByRole("button", { name: "Drafting…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Draft" })).toBeDisabled();
  });
});

describe("AvailablePlayers position caps", () => {
  it("greys out a capped position with its reason and blocks drafting and queueing", () => {
    renderList({ cappedPositions: { QB: "You already have 2 QBs, the most your league allows" } });
    expect(screen.getAllByText(/You already have 2 QBs/)).toHaveLength(2);
    for (const button of screen.getAllByRole("button", { name: "Position full" })) {
      expect(button).toBeDisabled();
    }
    for (const button of screen.getAllByRole("button", { name: "Queue" })) {
      expect(button).toBeDisabled();
    }
  });
});

describe("AvailablePlayers team QB / team K", () => {
  it("badges only the players the API flags as scoring the whole team", () => {
    renderList({
      players: [
        { ...player(1, "Pat Mahomes"), scoresWholeTeam: true },
        { ...player(2, "Josh Allen"), position: "QB" },
      ],
    });
    expect(screen.getAllByRole("note")).toHaveLength(1);
    expect(screen.getByRole("note", { name: /Scores all KC QBs/ })).toBeTruthy();
  });

  it("tags injured players in the pool", () => {
    renderList({
      players: [{ ...player(1, "Pat Mahomes"), injuryStatus: "Out" }, player(2, "Josh Allen")],
    });
    expect(screen.getAllByLabelText(/Injury status/)).toHaveLength(1);
    expect(screen.getByLabelText("Injury status: Out")).toBeTruthy();
  });
});
