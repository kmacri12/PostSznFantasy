import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Confetti from "./Confetti";

const reduced = vi.hoisted(() => ({ value: false }));
vi.mock("../../hooks/useReducedMotion", () => ({ useReducedMotion: () => reduced.value }));

describe("Confetti", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    reduced.value = false;
  });
  afterEach(() => vi.useRealTimers());

  it("ends by itself after one burst", () => {
    const onDone = vi.fn();
    render(<Confetti onDone={onDone} />);
    expect(screen.getByTestId("confetti")).toBeTruthy();
    act(() => vi.advanceTimersByTime(4600));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("goes away on a tap", () => {
    const onDone = vi.fn();
    render(<Confetti onDone={onDone} />);
    fireEvent.click(screen.getByTestId("confetti"));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("shows nothing and starts no timer under reduced motion", () => {
    reduced.value = true;
    const onDone = vi.fn();
    render(<Confetti onDone={onDone} />);
    expect(screen.queryByTestId("confetti")).toBeNull();
    act(() => vi.advanceTimersByTime(10000));
    expect(onDone).not.toHaveBeenCalled();
  });
});
