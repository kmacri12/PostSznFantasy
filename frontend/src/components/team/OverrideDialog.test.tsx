import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import OverrideDialog from "./OverrideDialog";

const dialog = (props: Partial<Parameters<typeof OverrideDialog>[0]> = {}) =>
  render(
    <OverrideDialog
      pending={false}
      teamName="Team 3"
      onConfirm={() => {}}
      onCancel={() => {}}
      {...props}
    />,
  );

describe("OverrideDialog", () => {
  it("names the team, says the owner is notified and the league sees it in the Feed", () => {
    dialog();
    expect(screen.getByRole("heading", { name: "Commissioner action" })).toBeTruthy();
    expect(
      screen.getByText(/You're changing Team 3's lineup\. Its owner is notified\./),
    ).toBeTruthy();
    expect(screen.getByText(/The league sees this in the Feed\./)).toBeTruthy();
  });

  it("uses the stronger wording once a game has kicked off", () => {
    dialog({ locked: true });
    expect(screen.getByText(/after-kickoff override/)).toBeTruthy();
  });

  it("only changes anything when confirmed", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    dialog({ onConfirm, onCancel });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
