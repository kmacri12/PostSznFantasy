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
    vi.unstubAllEnvs();
  });

  it("explains a failed refresh", async () => {
    vi.stubEnv("VITE_ADMIN_SUPABASE_UIDS", "admin-1");
    userState.user = { id: "admin-1" };
    vi.mocked(api.post).mockRejectedValue(new Error("boom"));
    renderBar();
    fireEvent.click(await screen.findByRole("button", { name: "Refresh now" }));
    expect(await screen.findByText("Couldn't refresh stats. Try again.")).toBeInTheDocument();
    vi.unstubAllEnvs();
  });
});
