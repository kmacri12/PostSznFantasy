import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api/client";
import LiveStatsNotice, { formatAgo } from "./LiveStatsNotice";

const NOW = Date.parse("2026-01-10T12:00:00Z");
const ago = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();

vi.mock("../../api/client", () => ({ api: { get: vi.fn(), post: vi.fn() } }));

const renderBar = () =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <LiveStatsNotice />
    </QueryClientProvider>,
  );

describe("formatAgo", () => {
  it.each([
    [0, "just now"],
    [1, "1 min ago"],
    [7, "7 min ago"],
    [59, "59 min ago"],
    [60, "1 h ago"],
    [60 * 5, "5 h ago"],
    [60 * 24 * 2, "2 d ago"],
  ])("%i minutes -> %s", (minutes, expected) => {
    expect(formatAgo(ago(minutes), NOW)).toBe(expected);
  });
});

describe("LiveStatsNotice", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.mocked(api.get).mockReset();
    vi.mocked(api.post).mockReset();
    vi.mocked(api.get).mockResolvedValue({
      data: [{ kind: "box_scores", lastSyncedAt: new Date(Date.now() - 7 * 60_000).toISOString() }],
    });
  });

  it("takes no space while stats sync normally, and has no Refresh now", async () => {
    const { container } = renderBar();
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("button", { name: "Refresh now" })).toBeNull();
  });

  it("says live updates are paused when the daily API limit is spent", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: [
        {
          kind: "box_scores",
          lastSyncedAt: new Date(Date.now() - 42 * 60_000).toISOString(),
          budgetExhausted: true,
        },
      ],
    });
    renderBar();
    const notice = await screen.findByRole("status");
    expect(notice).toHaveTextContent(
      "Live updates paused for today (API daily limit). Showing the last update from 42 min ago.",
    );
  });
});
