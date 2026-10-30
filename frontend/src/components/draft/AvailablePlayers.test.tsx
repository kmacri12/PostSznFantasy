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
