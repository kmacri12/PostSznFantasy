import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api/client";
import LiveStatsNotice, { formatAgo } from "./LiveStatsNotice";

const NOW = Date.parse("2026-01-10T12:00:00Z");
const ago = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();

vi.mock("../../contexts/UserContext", () => ({ useUser: () => ({ user: userState.user }) }));
const userState: { user: { id: string } | null } = { user: null };

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
    userState.user = null;
    vi.mocked(api.get).mockReset();
    vi.mocked(api.post).mockReset();
    vi.mocked(api.get).mockResolvedValue({
      data: [{ kind: "box_scores", lastSyncedAt: new Date(Date.now() - 7 * 60_000).toISOString() }],
    });
  });

  it("takes no space for regular users while stats sync normally", async () => {
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

  it("lets an admin refresh live stats", async () => {
    vi.stubEnv("VITE_ADMIN_SUPABASE_UIDS", "other, admin-1");
    userState.user = { id: "admin-1" };
    vi.mocked(api.post).mockResolvedValue({ data: { polled: 2 } });
    renderBar();
    fireEvent.click(await screen.findByRole("button", { name: "Refresh now" }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/api/admin/refresh/live"));
    expect(await screen.findByText("Refreshed: 2 live games updated.")).toBeInTheDocument();
    vi.unstubAllEnvs();
  });

  it("disables the button while refreshing and reloads standings, team and stats after", async () => {
    vi.stubEnv("VITE_ADMIN_SUPABASE_UIDS", "admin-1");
    userState.user = { id: "admin-1" };
    let finish: (value: unknown) => void = () => {};
    vi.mocked(api.post).mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    render(
      <QueryClientProvider client={client}>
        <LiveStatsNotice />
      </QueryClientProvider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Refresh now" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Refresh now" })).toBeDisabled());
    finish({ data: { polled: 1 } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Refresh now" })).toBeEnabled());
    const keys = invalidate.mock.calls.map((call) => (call[0]?.queryKey ?? [])[0]);
    expect(keys).toEqual(
      expect.arrayContaining(["sync-status", "standings", "team", "player-season-stats"]),
    );
    vi.unstubAllEnvs();
  });

  it("says when there was nothing to refresh", async () => {
    vi.stubEnv("VITE_ADMIN_SUPABASE_UIDS", "admin-1");
    userState.user = { id: "admin-1" };
    vi.mocked(api.post).mockResolvedValue({ data: { polled: 0 } });
    renderBar();
    fireEvent.click(await screen.findByRole("button", { name: "Refresh now" }));
    expect(
      await screen.findByText(/Nothing to refresh: no live games, or the daily API limit is spent/),
    ).toBeInTheDocument();
    vi.unstubAllEnvs();
  });

  it("explains a failed refresh", async () => {
    vi.stubEnv("VITE_ADMIN_SUPABASE_UIDS", "admin-1");
    userState.user = { id: "admin-1" };
    vi.mocked(api.post).mockRejectedValue(new Error("boom"));
    renderBar();
    fireEvent.click(await screen.findByRole("button", { name: "Refresh now" }));
    expect(await screen.findByText("Couldn't refresh stats. Try again.")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't refresh stats. Try again.");
    vi.unstubAllEnvs();
  });
});
