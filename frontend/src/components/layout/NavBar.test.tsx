import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LeagueByUser } from "../../api/types";
import NavBar from "./NavBar";

vi.mock("../dev/DevQuickSync", () => ({ DevQuickSync: () => null }));
vi.mock("./InboxBell", () => ({
  default: () => (
    <button type="button" aria-label="Notifications">
      bell
    </button>
  ),
}));
vi.mock("../settings/ProfileSheet", () => ({
  default: ({ onSignOut }: { onSignOut: () => void }) => (
    <div role="dialog" aria-label="Profile settings">
      <button type="button" onClick={onSignOut}>
        Sign out
      </button>
    </div>
  ),
}));

const league = (id: number, finished: boolean, hasNewActivity = false): LeagueByUser => ({
  id,
  name: `League ${id}`,
  seasonId: id * 10,
  season: 2026,
  isCommissioner: false,
  userTeamId: id,
  hasNewActivity,
  newActivityCount: hasNewActivity ? 1 : 0,
  finished,
  draftStatus: "completed",
  seasons: [],
});

const user = { id: "u", email: "a@b.c", user_metadata: {} } as never;

const Where = () => <div data-testid="where">{useLocation().pathname}</div>;

const renderBar = (props: Partial<React.ComponentProps<typeof NavBar>> = {}) => {
  const leagues = [league(1, true, true), league(2, false)];
  return render(
    <MemoryRouter>
      <NavBar
        user={user}
        leagues={leagues}
        league={leagues[1]}
        onSignIn={() => {}}
        onSignOut={() => {}}
        {...props}
      />
      <Routes>
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
};

beforeEach(() => {
  window.matchMedia = ((query: string) => ({
    matches: true,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
});

describe("NavBar", () => {
  it("has no hamburger or drawer", () => {
    renderBar();
    expect(screen.queryByRole("button", { name: "Open menu" })).toBeNull();
  });

  it("shows the full logo on the left, in a league or not, and the switcher only inside one", () => {
    const { unmount } = renderBar({ league: undefined });
    expect(screen.getByRole("link", { name: "PostSzn Fantasy" }).textContent).toBe(
      "PostSznFANTASY",
    );
    expect(screen.queryByRole("button", { name: /League/ })).toBeNull();
    unmount();
    renderBar();
    const logo = screen.getByRole("link", { name: /your leagues/ });
    expect(logo.textContent).toBe("PostSznFANTASY");
    expect(logo.getAttribute("href")).toBe("/");
    const switcher = screen.getByRole("button", { name: /League 2/ });
    const account = screen.getByRole("button", { name: "Profile settings" });
    // Logo, then switcher, then the avatar furthest right.
    expect(logo.compareDocumentPosition(switcher) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(
      switcher.compareDocumentPosition(account) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("leaves the logo to the rail on desktop and keeps the switcher in the bar", () => {
    renderBar({ railed: true });
    expect(screen.queryByRole("link", { name: /your leagues/ })).toBeNull();
    expect(screen.getByRole("button", { name: /League 2/ })).toBeInTheDocument();
  });

  it("lists each league once, with its dot and season-over tag, then Create a league", () => {
    renderBar();
    fireEvent.click(screen.getByRole("button", { name: /League 2/ }));
    expect(screen.getAllByRole("menuitem").map((item) => item.textContent?.trim())).toEqual([
      "League 1Season over",
      "League 2",
      "Create a league",
    ]);
    expect(screen.getAllByRole("img", { name: "New activity" })).toHaveLength(1);
    expect(screen.queryByText(/All leagues|Join with a code/)).toBeNull();
  });

  it("opens the chosen league", () => {
    renderBar();
    fireEvent.click(screen.getByRole("button", { name: /League 2/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: /League 1/ }));
    expect(screen.getByTestId("where").textContent).toBe("/leagues/1");
  });

  it("puts the notification bell between the switcher and the avatar, only when signed in", () => {
    const { unmount } = renderBar();
    const switcher = screen.getByRole("button", { name: /League 2/ });
    const bell = screen.getByRole("button", { name: "Notifications" });
    const account = screen.getByRole("button", { name: "Profile settings" });
    expect(switcher.compareDocumentPosition(bell) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(bell.compareDocumentPosition(account) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    unmount();
    renderBar({ user: null });
    expect(screen.queryByRole("button", { name: "Notifications" })).toBeNull();
  });

  it("opens profile settings from the avatar, and signing out from there signs out", () => {
    const onSignOut = vi.fn();
    renderBar({ onSignOut });
    expect(screen.queryByRole("dialog", { name: "Profile settings" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Profile settings" }));
    expect(screen.getByRole("dialog", { name: "Profile settings" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(onSignOut).toHaveBeenCalled();
  });
});
