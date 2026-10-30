import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import OnTheClockBanner from "./OnTheClockBanner";

describe("OnTheClockBanner", () => {
  it("announces my turn with the timer", () => {
    render(<OnTheClockBanner active secondsLeft={30} isConnected />);
    expect(screen.getByText("You're on the clock")).toBeTruthy();
    expect(screen.getByLabelText("Pick clock").textContent).toBe("00:30");
  });

  it("is absent when it is not my turn", () => {
    render(<OnTheClockBanner active={false} secondsLeft={30} isConnected />);
    expect(screen.queryByText("You're on the clock")).toBeNull();
  });

  it("marks the timer stale when disconnected", () => {
    render(<OnTheClockBanner active secondsLeft={30} isConnected={false} />);
    expect(screen.getByText("Reconnecting…")).toBeTruthy();
  });
});
