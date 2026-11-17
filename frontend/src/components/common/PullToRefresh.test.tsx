import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { api } from "../../api/client";
import PullToRefresh from "./PullToRefresh";
import {
  latestUpdate,
  liveStatsLine,
  PULL_MAX,
  pullDistance,
  screenLine,
  shouldRefresh,
} from "./pullToRefresh";

vi.mock("../../api/client", () => ({ api: { get: vi.fn() } }));

const NOW = Date.parse("2026-01-10T12:00:00Z");
const minutesAgo = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();

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

describe("indicator lines", () => {
  it("speaks of this screen for what the pull itself does", () => {
    expect(screenLine({ done: false, armed: false, updatedAt: NOW - 120_000 }, NOW)).toBe(
      "This screen updated 2 min ago",
    );
    expect(screenLine({ done: false, armed: false, updatedAt: 0 }, NOW)).toBe(
      "Pull to refresh this screen",
    );
    expect(screenLine({ done: false, armed: true, updatedAt: NOW }, NOW)).toBe(
      "Release to refresh this screen",
    );
    expect(screenLine({ done: true, armed: false, updatedAt: NOW }, NOW)).toBe(
      "This screen is up to date",
    );
  });

  it("says live stats sync on their own, and when they last did", () => {
    expect(liveStatsLine(undefined, NOW)).toBeNull();
    expect(liveStatsLine([], NOW)).toBe("Live stats auto-sync once games start");
    const synced = { kind: "box_scores", lastSyncedAt: minutesAgo(4), budgetExhausted: false };
    expect(liveStatsLine([synced], NOW)).toBe(
      "Live stats auto-sync during games · synced 4 min ago",
    );
    expect(liveStatsLine([{ ...synced, budgetExhausted: true }], NOW)).toBe(
      "Live stats paused for today · synced 4 min ago",
    );
  });
});

describe("PullToRefresh", () => {
  const setup = () => {
    vi.mocked(api.get).mockResolvedValue({
      data: [{ kind: "box_scores", lastSyncedAt: new Date(Date.now() - 4 * 60_000).toISOString() }],
    });
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

  it("shows no update lines at rest, and both only briefly after a refresh", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      setup();
      await waitFor(() => expect(api.get).toHaveBeenCalled());
      expect(screen.queryByText(/This screen/)).toBeNull();
      expect(screen.queryByText(/Live stats/)).toBeNull();
      act(() => {
        touch("touchstart", 10);
        touch("touchmove", 160);
        touch("touchend", 160);
      });
      const status = await screen.findByRole("status");
      expect(status).toHaveTextContent("This screen is up to date");
      expect(status).toHaveTextContent("Live stats auto-sync during games · synced 4 min ago");
      await act(() => vi.advanceTimersByTimeAsync(2100));
      expect(screen.queryByText("This screen is up to date")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
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
