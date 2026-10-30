import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { friendlyError } from "./friendlyError";
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

describe("QueryBoundary", () => {
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
    expect(screen.getByRole("alert")).toHaveTextContent("Reload standings");
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
