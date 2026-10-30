import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HOW_TO_PLAY_SECTIONS } from "../content/rules";
import HowToPlayPage from "./HowToPlayPage";

describe("how to play", () => {
  it("has a heading per rule section and a jump link to each", () => {
    render(<HowToPlayPage />);
    for (const section of HOW_TO_PLAY_SECTIONS) {
      expect(screen.getByRole("heading", { level: 2, name: section.title })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: section.title })).toHaveAttribute(
        "href",
        `#${section.id}`,
      );
    }
  });

  it("explains team QB with a concrete example", () => {
    render(<HowToPlayPage />);
    expect(screen.getByText(/Jalen Hurts and score every Eagles QB/)).toBeVisible();
  });
});
