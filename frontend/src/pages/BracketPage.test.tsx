import { fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import BracketPage from "./BracketPage";

vi.mock("../api/queries", () => ({ useBracket: () => ({ isLoading: true }) }));
vi.mock("../components/common/QueryBoundary", () => ({ default: () => null }));
vi.mock("../contexts/SeasonContext", () => ({
  useSeasonContext: () => ({ seasonId: 5, paths: { home: "/leagues/1" } }),
}));

const open = (entries: string[], index: number) => {
  const router = createMemoryRouter(
    [
      { path: "/leagues/1", element: <p>League home</p> },
      { path: "/leagues/1/more", element: <p>More page</p> },
      { path: "/leagues/1/bracket", element: <BracketPage /> },
    ],
    { initialEntries: entries, initialIndex: index },
  );
  render(<RouterProvider router={router} />);
  return router;
};

describe("BracketPage back arrow", () => {
  it("returns to the page the member came from", () => {
    window.history.replaceState({ idx: 1 }, "");
    open(["/leagues/1/more", "/leagues/1/bracket"], 1);
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByText("More page")).toBeInTheDocument();
  });

  it("goes to the league home when there is no history", () => {
    window.history.replaceState({ idx: 0 }, "");
    open(["/leagues/1/bracket"], 0);
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByText("League home")).toBeInTheDocument();
  });
});
