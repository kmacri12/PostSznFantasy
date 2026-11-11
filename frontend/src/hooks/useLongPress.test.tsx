import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLongPress } from "./useLongPress";

const onLongPress = vi.fn();

const Target = () => {
  const handlers = useLongPress(onLongPress);
  return (
    <div data-testid="target" {...handlers}>
      press me
    </div>
  );
};

const touch = (x: number, y: number) => ({ touches: [{ clientX: x, clientY: y }] });

beforeEach(() => {
  vi.useFakeTimers();
  onLongPress.mockReset();
});
afterEach(() => vi.useRealTimers());

describe("useLongPress", () => {
  it("fires after a still press", () => {
    render(<Target />);
    fireEvent.touchStart(screen.getByTestId("target"), touch(10, 10));
    act(() => vi.advanceTimersByTime(500));
    expect(onLongPress).toHaveBeenCalledWith(screen.getByTestId("target"));
  });

  it("does not fire when the finger lifts early", () => {
    render(<Target />);
    fireEvent.touchStart(screen.getByTestId("target"), touch(10, 10));
    act(() => vi.advanceTimersByTime(200));
    fireEvent.touchEnd(screen.getByTestId("target"));
    act(() => vi.advanceTimersByTime(500));
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("does not fire when the finger scrolls, but forgives a small wobble", () => {
    render(<Target />);
    const target = screen.getByTestId("target");
    fireEvent.touchStart(target, touch(10, 10));
    fireEvent.touchMove(target, touch(12, 13));
    act(() => vi.advanceTimersByTime(500));
    expect(onLongPress).toHaveBeenCalledTimes(1);

    onLongPress.mockReset();
    fireEvent.touchStart(target, touch(10, 10));
    fireEvent.touchMove(target, touch(10, 60));
    act(() => vi.advanceTimersByTime(500));
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("does not fire when the browser cancels the touch", () => {
    render(<Target />);
    const target = screen.getByTestId("target");
    fireEvent.touchStart(target, touch(10, 10));
    fireEvent.touchCancel(target);
    act(() => vi.advanceTimersByTime(500));
    expect(onLongPress).not.toHaveBeenCalled();
  });
});
