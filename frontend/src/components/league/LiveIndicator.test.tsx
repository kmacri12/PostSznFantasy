import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LiveIndicator, { liveAgo } from "./LiveIndicator";

const useStandings = vi.fn();
vi.mock("../../api/queries", () => ({
  useStandings: (...args: unknown[]) => useStandings(...args),
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
    render(<LiveIndicator seasonId={1} />);
    expect(screen.getByText(/Live, updated \d+s ago/)).toBeInTheDocument();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("is absent when no game is live", () => {
    useStandings.mockReturnValue({ data: { gamesInProgress: 0 }, dataUpdatedAt: Date.now() });
    const { container } = render(<LiveIndicator seasonId={1} />);
    expect(container).toBeEmptyDOMElement();
  });
});
