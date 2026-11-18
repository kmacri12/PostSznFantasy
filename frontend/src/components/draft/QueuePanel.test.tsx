import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PlayerSummary } from "../../api/types";
import QueuePanel from "./QueuePanel";

const player = (id: number, name: string, position: string): PlayerSummary => ({
  id,
  name,
  position,
  teamAbv: "BUF",
});
const players = new Map([
  [1, player(1, "Josh Allen", "QB")],
  [2, player(2, "Tyler Bass", "K")],
]);

const draft = (overrides = {}) => ({
  live: true,
  canPick: true,
  isConnected: true,
  pendingPlayerId: null,
  capped: {},
  onPick: vi.fn(),
  ...overrides,
});

const renderPanel = (d: ReturnType<typeof draft> | undefined) =>
  render(
    <QueuePanel
      queue={[1, 2]}
      players={players}
      draftedIds={new Set()}
      onChange={vi.fn()}
      draft={d}
    />,
  );

describe("QueuePanel Draft button", () => {
  it("has none outside a live draft", () => {
    renderPanel(undefined);
    expect(screen.queryByRole("button", { name: /^Draft / })).toBeNull();
  });

  it("needs a second tap to draft a queued player", () => {
    const d = draft();
    renderPanel(d);
    fireEvent.click(screen.getByRole("button", { name: "Draft Josh Allen" }));
    expect(d.onPick).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm Josh Allen" }));
    expect(d.onPick).toHaveBeenCalledWith(1);
  });

  it("is disabled off my turn", () => {
    renderPanel(draft({ canPick: false }));
    expect(screen.getByRole("button", { name: "Draft Josh Allen" })).toBeDisabled();
  });

  it("is disabled for a capped position", () => {
    renderPanel(draft({ capped: { K: "Position max reached" } }));
    expect(screen.getByRole("button", { name: "Position full" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Draft Josh Allen" })).toBeEnabled();
  });
});
