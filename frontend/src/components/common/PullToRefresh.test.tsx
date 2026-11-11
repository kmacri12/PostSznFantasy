import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PullToRefresh from "./PullToRefresh";
import { latestUpdate, PULL_MAX, pullDistance, shouldRefresh } from "./pullToRefresh";

const touch = (type: string, clientY: number) =>
  fireEvent(
    document,
    Object.assign(new Event(type, { bubbles: true, cancelable: true }), {
      touches: type === "touchend" ? [] : [{ clientY }],
    }),
  );

describe("pull distance", () => {
  it("damps the finger, caps the indicator and refreshes past the threshold", () => {
    expect(pullDistance(-20)).toBe(0);
    expect(pullDistance(100)).toBe(50);
    expect(pullDistance(1000)).toBe(PULL_MAX);
    expect(shouldRefresh(pullDistance(100))).toBe(false);
    expect(shouldRefresh(pullDistance(140))).toBe(true);
  });

  it("finds the newest update", () => {
    expect(latestUpdate([])).toBe(0);
    expect(latestUpdate([5, 9, 3])).toBe(9);
  });
});

describe("PullToRefresh", () => {
  const setup = () => {
    const client = new QueryClient();
    const refetch = vi.spyOn(client, "refetchQueries").mockResolvedValue();
    render(
      <QueryClientProvider client={client}>
        <PullToRefresh>
          <p>Page</p>
        </PullToRefresh>
      </QueryClientProvider>,
    );
    return refetch;
  };

  it("refetches the page's queries after a long pull from the top", async () => {
    const refetch = setup();
    act(() => {
      touch("touchstart", 10);
      touch("touchmove", 160);
      touch("touchend", 160);
    });
    await waitFor(() => expect(refetch).toHaveBeenCalledWith({ type: "active" }));
    expect(screen.getByText("Page")).toBeInTheDocument();
  });

  it("ignores a short pull", () => {
    const refetch = setup();
    act(() => {
      touch("touchstart", 10);
      touch("touchmove", 60);
      touch("touchend", 60);
    });
    expect(refetch).not.toHaveBeenCalled();
  });

  it("ignores a pull while a sheet is open", () => {
    const refetch = setup();
    const modal = document.createElement("div");
    modal.className = "MuiModal-root";
    document.body.append(modal);
    act(() => {
      touch("touchstart", 10);
      touch("touchmove", 200);
      touch("touchend", 200);
    });
    modal.remove();
    expect(refetch).not.toHaveBeenCalled();
  });
});
