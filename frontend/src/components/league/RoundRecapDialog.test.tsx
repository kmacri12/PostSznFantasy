import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ThemeModeProvider } from "../../contexts/ThemeModeContext";
import RoundRecapDialog from "./RoundRecapDialog";

const highlights = [
  { kind: "top_team", text: "Kmac led the week.", teamId: 1 },
  { kind: "none_lost", text: "Team 4 came through without losing a player.", teamId: 4 },
];

const teams = {
  1: { name: "Kmac", avatarUrl: null, picture: { color: 3, icon: 1 } },
};

const show = (onClose = vi.fn(), withTeams = false) =>
  render(
    <MemoryRouter>
      <ThemeModeProvider>
        <RoundRecapDialog
          open
          onClose={onClose}
          leagueName="Fake League"
          year={2026}
          round={1}
          highlights={highlights}
          teams={withTeams ? teams : undefined}
        />
      </ThemeModeProvider>
    </MemoryRouter>,
  );

describe("RoundRecapDialog", () => {
  it("puts the brand, the league and every highlight on one screen, with a share button", () => {
    show();
    expect(screen.getByRole("img", { name: "PostSzn Fantasy" })).toBeInTheDocument();
    expect(screen.getByText("WILD CARD RECAP")).toBeInTheDocument();
    expect(screen.getByText("Fake League")).toBeInTheDocument();
    expect(screen.getByText("Kmac led the week.")).toBeInTheDocument();
    expect(screen.getByText("Team 4 came through without losing a player.")).toBeInTheDocument();
    expect(screen.getByText("postsznfantasy.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Share recap" })).toBeInTheDocument();
  });

  it("closes from its own button", () => {
    const onClose = vi.fn();
    show(onClose);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("puts the team's own picture on the emoji of a line about that team, and only there", () => {
    show(vi.fn(), true);
    // The first line is about team 1; the other has no single team.
    expect(screen.getAllByTestId("recap-team-picture")).toHaveLength(1);
  });

  it("shows no team pictures without the teams", () => {
    show();
    expect(screen.queryByTestId("recap-team-picture")).not.toBeInTheDocument();
  });
});
