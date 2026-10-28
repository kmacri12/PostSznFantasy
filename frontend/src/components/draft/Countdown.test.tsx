import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Countdown from "./Countdown";

describe("Countdown Component", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders formatted time correctly", () => {
    render(<Countdown time={75} />);
    expect(screen.getByText("1:15")).toBeInTheDocument();
  });

  it("counts down seconds", () => {
    render(<Countdown time={10} />);
    expect(screen.getByText("0:10")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.getByText("0:07")).toBeInTheDocument();
  });

  it("stops at 0:00 without going negative", () => {
    render(<Countdown time={2} />);
    expect(screen.getByText("0:02")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getByText("0:00")).toBeInTheDocument();
  });

  it("resets when time prop changes", () => {
    const { rerender } = render(<Countdown time={60} />);
    expect(screen.getByText("1:00")).toBeInTheDocument();

    rerender(<Countdown time={30} />);
    expect(screen.getByText("0:30")).toBeInTheDocument();
  });
});
