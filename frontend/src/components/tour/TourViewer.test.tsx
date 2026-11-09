import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TOUR_STAGES, TOUR_STEPS } from "../../content/rules";
import TourViewer from "./TourViewer";

describe("TourViewer", () => {
  it("steps through every screen with Next and Back and finishes on the last", () => {
    const onFinish = vi.fn();
    render(<TourViewer onFinish={onFinish} />);
    expect(screen.getByRole("heading", { name: TOUR_STEPS[0]?.title })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();

    for (const step of TOUR_STEPS.slice(1)) {
      fireEvent.click(screen.getByRole("button", { name: "Next" }));
      expect(screen.getByRole("heading", { name: step.title })).toBeInTheDocument();
    }
    fireEvent.click(screen.getByRole("button", { name: "Got it" }));
    expect(onFinish).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("heading", { name: TOUR_STEPS.at(-2)?.title })).toBeInTheDocument();
  });

  it("swipes between screens", () => {
    render(<TourViewer />);
    const group = screen.getByRole("group");
    fireEvent.touchStart(group, { touches: [{ clientX: 300 }] });
    fireEvent.touchEnd(group, { changedTouches: [{ clientX: 100 }] });
    expect(screen.getByRole("heading", { name: TOUR_STEPS[1]?.title })).toBeInTheDocument();
  });

  it("has an image with alt text and a file for every step", () => {
    for (const step of TOUR_STEPS) {
      expect(step.alt.length).toBeGreaterThan(10);
      expect(step.stage === null || step.stage < TOUR_STAGES.length).toBe(true);
    }
  });

  it("covers every season stage in order", () => {
    const stages = TOUR_STEPS.flatMap((step) => (step.stage === null ? [] : [step.stage]));
    expect(stages).toEqual(TOUR_STAGES.map((_, index) => index));
  });
});
