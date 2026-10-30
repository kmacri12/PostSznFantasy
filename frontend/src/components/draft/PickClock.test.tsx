import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PickClock from "./PickClock";

describe("PickClock", () => {
  it("shows the time plainly while connected", () => {
    render(<PickClock secondsLeft={75} isConnected />);
    expect(screen.getByLabelText("Pick clock").textContent).toBe("01:15");
    expect(screen.queryByText("Reconnecting…")).toBeNull();
  });

  it("keeps the time visible but marks it stale while disconnected", () => {
    render(<PickClock secondsLeft={75} isConnected={false} />);
    const clock = screen.getByLabelText("Pick clock");
    expect(clock.textContent).toBe("01:15");
    expect(getComputedStyle(clock).opacity).toBe("0.4");
    expect(screen.getByText("Reconnecting…")).toBeTruthy();
  });

  it("renders nothing without a countdown", () => {
    render(<PickClock secondsLeft={null} isConnected />);
    expect(screen.queryByLabelText("Pick clock")).toBeNull();
  });
});
