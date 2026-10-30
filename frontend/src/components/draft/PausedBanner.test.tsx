import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PausedBanner from "./PausedBanner";

describe("PausedBanner", () => {
  it("announces a paused draft", () => {
    render(<PausedBanner status="paused" />);
    expect(screen.getByRole("status").textContent).toMatch(/paused the draft/i);
  });

  it("stays out of the way otherwise", () => {
    render(<PausedBanner status="in_progress" />);
    expect(screen.queryByRole("status")).toBeNull();
  });
});
