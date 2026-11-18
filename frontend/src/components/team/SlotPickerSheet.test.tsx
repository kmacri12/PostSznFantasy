import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { lineupPlayer, roundLineup, slot } from "../../test/lineup";
import SlotPickerSheet from "./SlotPickerSheet";

const lineup = roundLineup(2, {
  slots: [
    slot(0, "WR"),
    slot(1, "BENCH", lineupPlayer({ id: 3, name: "Brian Thomas Jr.", position: "WR" })),
  ],
});

const picker = (onMove = vi.fn()) =>
  render(
    <SlotPickerSheet
      lineup={lineup}
      slotIndex={0}
      canOverride={false}
      pending={false}
      error={null}
      onMove={onMove}
      onClose={vi.fn()}
    />,
  );

describe("SlotPickerSheet", () => {
  it("starts the chosen bench player in the slot", () => {
    const onMove = vi.fn();
    picker(onMove);
    fireEvent.click(screen.getByRole("button", { name: /Brian Thomas Jr\./ }));
    expect(onMove).toHaveBeenCalledWith({ playerId: 3, slotIndex: 0 });
  });
});
