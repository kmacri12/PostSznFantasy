import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DraftToast from "./DraftToast";

describe("DraftToast", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("shows the message and dismisses itself after about 5 seconds", () => {
    const onClose = vi.fn();
    render(<DraftToast toast={{ id: 1, message: "Your roster is full" }} onClose={onClose} />);
    expect(screen.getByText("Your roster is full")).toBeTruthy();
    act(() => vi.advanceTimersByTime(4900));
    expect(onClose).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(200));
    expect(onClose).toHaveBeenCalled();
  });

  it("renders nothing without a toast", () => {
    render(<DraftToast toast={null} onClose={vi.fn()} />);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
