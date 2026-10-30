import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import OverrideDialog from "./OverrideDialog";

describe("OverrideDialog", () => {
  it("warns that the move is commissioner-only and the league will be told", () => {
    render(<OverrideDialog pending={false} onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.getByText("Are you sure?")).toBeTruthy();
    expect(
      screen.getByText("This is a commissioner-only move and the league will be notified."),
    ).toBeTruthy();
  });

  it("only changes anything when confirmed", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<OverrideDialog pending={false} onConfirm={onConfirm} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Make the change" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
