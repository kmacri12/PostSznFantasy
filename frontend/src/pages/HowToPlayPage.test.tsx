import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { HOW_TO_PLAY_GROUPS } from "../content/rules";
import HowToPlayPage from "./HowToPlayPage";

describe("how to play", () => {
  it("groups the rules under four headings, one accordion row per rule", () => {
    render(
      <MemoryRouter>
        <HowToPlayPage />
      </MemoryRouter>,
    );
    expect(HOW_TO_PLAY_GROUPS.map((g) => g.title)).toEqual([
      "Before the draft",
      "The draft",
      "Each round",
      "Scoring and ties",
    ]);
    for (const group of HOW_TO_PLAY_GROUPS) {
      expect(screen.getByRole("heading", { level: 2, name: group.title })).toBeInTheDocument();
      for (const rule of group.rules) {
        expect(screen.getByRole("button", { name: rule.title })).toBeInTheDocument();
      }
    }
  });

  it("explains team QB with a concrete example once the rule is opened", () => {
    render(
      <MemoryRouter>
        <HowToPlayPage />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Team QB and team K" }));
    expect(screen.getByText(/Jalen Hurts and score every Eagles QB/)).toBeVisible();
  });

  it("leads with the tour card and opens the tour from it", () => {
    render(
      <MemoryRouter>
        <HowToPlayPage />
      </MemoryRouter>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const card = screen.getByRole("region", { name: "PostSzn Fantasy in a minute" });
    expect(
      card.compareDocumentPosition(screen.getByRole("heading", { name: "Before the draft" })),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    fireEvent.click(screen.getByRole("button", { name: "Take the tour" }));
    expect(screen.getByRole("dialog")).toBeVisible();
  });
});
