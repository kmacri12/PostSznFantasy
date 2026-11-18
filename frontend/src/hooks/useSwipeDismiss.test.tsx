import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useSwipeDismiss } from "./useSwipeDismiss";

const Sheet = ({ onClose }: { onClose: () => void }) => {
  const { ref, ...handlers } = useSwipeDismiss(onClose);
  return (
    <div ref={ref as React.RefObject<HTMLDivElement>} data-testid="sheet" {...handlers}>
      <div data-testid="body">content</div>
    </div>
  );
};

const swipe = (target: HTMLElement, distance: number) => {
  fireEvent.touchStart(target, { touches: [{ clientY: 100 }] });
  fireEvent.touchMove(target, { touches: [{ clientY: 100 + distance }] });
  fireEvent.touchEnd(target);
};

describe("useSwipeDismiss", () => {
  it("closes after a long downward swipe", () => {
    const onClose = vi.fn();
    render(<Sheet onClose={onClose} />);
    swipe(screen.getByTestId("body"), 200);
    expect(onClose).toHaveBeenCalled();
  });

  it("snaps back after a short drag", () => {
    const onClose = vi.fn();
    render(<Sheet onClose={onClose} />);
    swipe(screen.getByTestId("body"), 10);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId("sheet").style.transform).toBe("");
  });

  it("leaves a swipe inside scrolled content to the scroll", () => {
    const onClose = vi.fn();
    render(<Sheet onClose={onClose} />);
    const body = screen.getByTestId("body");
    Object.defineProperty(body, "scrollTop", { value: 40 });
    swipe(body, 300);
    expect(onClose).not.toHaveBeenCalled();
  });
});
