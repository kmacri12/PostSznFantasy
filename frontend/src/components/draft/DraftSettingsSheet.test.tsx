import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DraftState } from "../../api/types";
import DraftSettingsSheet from "./DraftSettingsSheet";

vi.mock("../../api/queries", () => ({
  useDraftSetup: () => ({ mutate: vi.fn(), isPending: false, error: null }),
}));

const draft = (overrides: Partial<DraftState> = {}) =>
  ({
    seasonId: 5,
    status: "scheduled",
    startTime: null,
    draftType: "snake",
    timePerPickSeconds: 90,
    pickTimeoutAction: "queue_then_best_available",
    orderLocked: false,
    ...overrides,
  }) as DraftState;

const open = (state: DraftState, canEdit: boolean) =>
  render(<DraftSettingsSheet draft={state} canEdit={canEdit} onClose={vi.fn()} />);

describe("DraftSettingsSheet", () => {
  it("shows everyone the date, clock, type and clock-expiry rule", () => {
    open(draft(), false);
    const sheet = screen.getByRole("dialog", { name: "Draft settings" });
    expect(sheet).toHaveTextContent("Draft dateNot set");
    expect(sheet).toHaveTextContent("Seconds per pick90");
    expect(sheet).toHaveTextContent("Draft typeSnake");
    expect(sheet).toHaveTextContent("When the clock runs outQueue, then best");
  });

  it("is read-only for a member", () => {
    open(draft(), false);
    expect(
      within(screen.getByRole("dialog")).queryByRole("button", { name: /Seconds per pick/ }),
    ).toBeNull();
  });

  it("lets a commissioner open the editors before the draft", () => {
    open(draft(), true);
    fireEvent.click(screen.getByRole("button", { name: /Seconds per pick/ }));
    expect(screen.getByRole("textbox", { name: "Seconds per pick" })).toBeInTheDocument();
  });

  it("is read-only for everyone once the draft is complete", () => {
    open(draft({ status: "completed" }), true);
    expect(screen.queryByRole("button", { name: /Seconds per pick/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Draft date/ })).toBeNull();
  });

  it("only lets the date change before the draft starts", () => {
    open(draft({ status: "in_progress" }), true);
    expect(screen.queryByRole("button", { name: /Draft date/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Seconds per pick/ })).toBeInTheDocument();
  });
});
