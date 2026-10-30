import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api/client";
import DataFreshness, { formatAgo } from "./DataFreshness";

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
      <DataFreshness />
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

describe("DataFreshness", () => {
  beforeEach(() => {
    vi.useRealTimers();
    userState.user = null;
    vi.mocked(api.get).mockReset();
    vi.mocked(api.post).mockReset();
    vi.mocked(api.get).mockResolvedValue({
      data: [{ kind: "box_scores", lastSyncedAt: new Date(Date.now() - 7 * 60_000).toISOString() }],
    });
  });

  it("says how old the stats are, without a refresh button for regular users", async () => {
    renderBar();
    expect(await screen.findByText("Stats updated 7 min ago")).toBeInTheDocument();
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
    expect(screen.queryByText(/^Stats updated/)).toBeNull();
  });

  it("says the update time is unavailable when the status request fails", async () => {
    vi.mocked(api.get).mockRejectedValue(new Error("down"));
    renderBar();
    expect(await screen.findByText("Update time unavailable")).toBeInTheDocument();
  });

  it("keeps showing the last known update time when a later status request fails", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <DataFreshness />
      </QueryClientProvider>,
    );
    expect(await screen.findByText("Stats updated 7 min ago")).toBeInTheDocument();
    vi.mocked(api.get).mockRejectedValue(new Error("down"));
    await client.refetchQueries({ queryKey: ["sync-status"] });
    expect(await screen.findByText("Stats updated 7 min ago")).toBeInTheDocument();
  });

  it("says so when stats have never synced", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [] });
    renderBar();
    expect(await screen.findByText("Stats haven't synced yet")).toBeInTheDocument();
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
        <DataFreshness />
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
