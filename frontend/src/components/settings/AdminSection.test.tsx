import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api/client";
import AdminSection from "./AdminSection";

vi.mock("../../api/client", () => ({ api: { get: vi.fn(), post: vi.fn() } }));

const renderSection = (userId: string, client = new QueryClient()) =>
  render(
    <QueryClientProvider client={client}>
      <AdminSection userId={userId} />
    </QueryClientProvider>,
  );

const refreshRow = () => screen.getByRole("button", { name: /^Refresh live stats/ });

describe("AdminSection", () => {
  beforeEach(() => {
    vi.mocked(api.post).mockReset();
    vi.stubEnv("VITE_ADMIN_SUPABASE_UIDS", "other, admin-1");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("renders nothing for someone who is not the site admin", () => {
    const { container } = renderSection("someone");
    expect(container).toBeEmptyDOMElement();
  });

  it("lets the admin refresh live stats and says how many games updated", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { polled: 2 } });
    renderSection("admin-1");
    expect(screen.getByRole("heading", { name: "Admin" })).toBeInTheDocument();
    fireEvent.click(refreshRow());
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/api/admin/refresh/live"));
    expect(await screen.findByRole("status")).toHaveTextContent("Refreshed: 2 live games updated.");
  });

  it("shows progress, ignores a second tap, and reloads standings, team and stats after", async () => {
    let finish: (value: unknown) => void = () => {};
    vi.mocked(api.post).mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    renderSection("admin-1", client);
    fireEvent.click(refreshRow());
    expect(await screen.findByText("Refreshing…")).toBeInTheDocument();
    fireEvent.click(refreshRow());
    expect(api.post).toHaveBeenCalledTimes(1);
    finish({ data: { polled: 1 } });
    expect(await screen.findByText("Refreshed: 1 live game updated.")).toBeInTheDocument();
    const keys = invalidate.mock.calls.map((call) => (call[0]?.queryKey ?? [])[0]);
    expect(keys).toEqual(
      expect.arrayContaining(["sync-status", "standings", "team", "player-season-stats"]),
    );
  });

  it("says when there was nothing to refresh", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { polled: 0 } });
    renderSection("admin-1");
    fireEvent.click(refreshRow());
    expect(
      await screen.findByText(/Nothing to refresh: no live games, or the daily API limit is spent/),
    ).toBeInTheDocument();
  });

  it("explains a failed refresh", async () => {
    vi.mocked(api.post).mockRejectedValue(new Error("boom"));
    renderSection("admin-1");
    fireEvent.click(refreshRow());
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't refresh stats. Try again.",
    );
  });
});
