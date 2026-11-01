import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { friendlyError, mutationError } from "./friendlyError";
import QueryBoundary from "./QueryBoundary";

const base = { isLoading: false, isError: false, error: null, data: undefined, refetch: vi.fn() };

describe("friendlyError", () => {
  it("prefers the server detail", () => {
    expect(friendlyError({ response: { data: { detail: "League is full." } } }, "x")).toBe(
      "League is full.",
    );
  });
  it("never leaks a raw exception message", () => {
    expect(friendlyError(new Error("Request failed with status code 500"), "Try again.")).toBe(
      "Try again.",
    );
  });
});

describe("mutationError", () => {
  it("is null while nothing has failed", () => {
    expect(mutationError(null, "Couldn't save. Try again.")).toBeNull();
  });
  it("falls back to the plain message when the server gave no detail", () => {
    expect(mutationError(new Error("Network Error"), "Couldn't save. Try again.")).toBe(
      "Couldn't save. Try again.",
    );
  });
});

describe("QueryBoundary", () => {
  it("shows the deleted-league page instead of an error with a retry", () => {
    const error = {
      response: {
        status: 404,
        data: {
          detail: "This league was deleted",
          code: "leagueDeleted",
          leagueName: "Dynasty Bros",
          deletedAt: "2026-11-01T12:00:00Z",
        },
      },
    };
    render(
      <MemoryRouter>
        <QueryBoundary query={{ ...base, isError: true, error }} what="this league">
          {() => <p>content</p>}
        </QueryBoundary>
      </MemoryRouter>,
    );
    expect(screen.getByText("This league was deleted by a commissioner")).toBeInTheDocument();
    expect(screen.getByText(/Dynasty Bros/)).toBeInTheDocument();
    expect(screen.getByText(/November 1, 2026/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /reload|try again/i })).not.toBeInTheDocument();
  });

  it("shows a status skeleton while loading", () => {
    render(
      <QueryBoundary query={{ ...base, isLoading: true }} what="standings">
        {() => <p>content</p>}
      </QueryBoundary>,
    );
    expect(screen.getByRole("status", { name: "Loading standings" })).toBeInTheDocument();
  });

  it("offers a retry that calls refetch", () => {
    const refetch = vi.fn();
    render(
      <QueryBoundary query={{ ...base, isError: true, refetch }} what="standings">
        {() => <p>content</p>}
      </QueryBoundary>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load standings");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(refetch).toHaveBeenCalled();
  });

  it("shows the empty state with its call to action", () => {
    render(
      <QueryBoundary
        query={{ ...base, data: [] }}
        what="standings"
        isEmpty={(rows) => rows.length === 0}
        empty={{ title: "No standings yet", action: <button type="button">Open draft</button> }}
      >
        {() => <p>content</p>}
      </QueryBoundary>,
    );
    expect(screen.getByText("No standings yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open draft" })).toBeInTheDocument();
  });

  it("renders children with the data", () => {
    render(
      <QueryBoundary query={{ ...base, data: [1, 2] }} what="x">
        {(rows) => <p>{rows.length} rows</p>}
      </QueryBoundary>,
    );
    expect(screen.getByText("2 rows")).toBeInTheDocument();
  });
});
