import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api/client";
import type { Inbox } from "../../api/types";
import InboxBell from "./InboxBell";

vi.mock("../../api/client", () => ({ api: { get: vi.fn(), post: vi.fn() } }));

const INBOX: Inbox = {
  unreadCount: 1,
  items: [
    {
      id: 7,
      kind: "draft_turn",
      leagueId: 3,
      leagueName: "Family League",
      payload: { seasonId: 9, teamId: 12 },
      createdAt: new Date().toISOString(),
      read: false,
    },
    {
      id: 6,
      kind: "lineup_changed",
      leagueId: 3,
      leagueName: "Family League",
      payload: { seasonId: 9, teamId: 12, round: 1 },
      createdAt: new Date(Date.now() - 3 * 3_600_000).toISOString(),
      read: true,
    },
  ],
};

const Where = () => <div data-testid="where">{useLocation().pathname}</div>;

const renderBell = () =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter>
        <InboxBell />
        <Routes>
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

beforeEach(() => {
  vi.mocked(api.get).mockReset().mockResolvedValue({ data: INBOX });
  vi.mocked(api.post).mockReset().mockResolvedValue({ data: null });
  window.matchMedia = ((query: string) => ({
    matches: true,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
});

describe("InboxBell", () => {
  it("says how many are unread and lists the last 30 days, unread first marked", async () => {
    renderBell();
    const bell = await screen.findByRole("button", { name: "Notifications, 1 unread" });
    fireEvent.click(bell);
    const sheet = screen.getByRole("dialog", { name: "Notifications" });
    expect(sheet).toHaveTextContent("You're on the clock");
    expect(sheet).toHaveTextContent("Your Wild Card lineup in Family League.");
    expect(screen.getAllByRole("img", { name: "Unread" })).toHaveLength(1);
  });

  it("marks a tapped entry read and opens its page", async () => {
    renderBell();
    fireEvent.click(await screen.findByRole("button", { name: "Notifications, 1 unread" }));
    fireEvent.click(screen.getByRole("button", { name: /You're on the clock/ }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/api/notifications/read", { ids: [7] }),
    );
    expect(screen.getByTestId("where").textContent).toBe("/leagues/3/draft");
  });

  it("does not mark a read entry again, and Mark all as read clears the rest", async () => {
    renderBell();
    fireEvent.click(await screen.findByRole("button", { name: "Notifications, 1 unread" }));
    fireEvent.click(screen.getByRole("button", { name: "Mark all as read" }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/api/notifications/read", {}));
    fireEvent.click(screen.getByRole("button", { name: /changed your lineup/ }));
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("where").textContent).toBe("/leagues/3/teams/12");
  });

  it("has a plain name and an empty note when nothing is there", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { items: [], unreadCount: 0 } });
    renderBell();
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    fireEvent.click(await screen.findByRole("button", { name: "Notifications" }));
    expect(screen.getByRole("dialog", { name: "Notifications" })).toHaveTextContent(
      "Nothing in the last 30 days",
    );
  });
});
