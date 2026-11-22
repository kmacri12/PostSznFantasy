import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import LiveIndicator, { liveAgo } from "./LiveIndicator";

const useStandings = vi.fn();
const features = { bracket: true };
vi.mock("../../api/queries", () => ({
  useStandings: (...args: unknown[]) => useStandings(...args),
  useFeatures: () => features,
}));

describe("liveAgo", () => {
  it("counts seconds, then minutes", () => {
    expect(liveAgo(1_000, 21_000)).toBe("20s ago");
    expect(liveAgo(0, 125_000)).toBe("2 min ago");
  });
});

describe("LiveIndicator", () => {
  it("shows while a game is live", () => {
    useStandings.mockReturnValue({ data: { gamesInProgress: 2 }, dataUpdatedAt: Date.now() });
    render(<LiveIndicator seasonId={1} games="2 games live" />);
    expect(screen.getByText(/^2 games live · updated \d+s ago$/)).toBeInTheDocument();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("opens the NFL schedule's live scores", () => {
    useStandings.mockReturnValue({ data: { gamesInProgress: 2 }, dataUpdatedAt: Date.now() });
    render(
      <MemoryRouter>
        <LiveIndicator seasonId={1} games="2 games live" schedule="/leagues/3/schedule" />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: /^2 games live · updated/ })).toHaveAttribute(
      "href",
      "/leagues/3/schedule",
    );
  });

  it("is plain text while the owner has the schedule switched off", () => {
    features.bracket = false;
    useStandings.mockReturnValue({ data: { gamesInProgress: 2 }, dataUpdatedAt: Date.now() });
    render(
      <MemoryRouter>
        <LiveIndicator seasonId={1} games="2 games live" schedule="/leagues/3/schedule" />
      </MemoryRouter>,
    );
    expect(screen.queryByRole("link")).toBeNull();
    features.bracket = true;
  });

  it("is absent when no game is live", () => {
    useStandings.mockReturnValue({ data: { gamesInProgress: 0 }, dataUpdatedAt: Date.now() });
    const { container } = render(<LiveIndicator seasonId={1} games="No games yet" />);
    expect(container).toBeEmptyDOMElement();
  });
});
