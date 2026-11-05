import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LeagueByUser } from "../../api/types";
import NavBar from "./NavBar";

vi.mock("../dev/DevQuickSync", () => ({ DevQuickSync: () => null }));

const league = (id: number, finished: boolean, hasNewActivity = false): LeagueByUser => ({
  id,
  name: `League ${id}`,
  seasonId: id * 10,
  season: 2026,
  isCommissioner: false,
  userTeamId: id,
  hasNewActivity,
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

  it("shows the wordmark outside a league and the square mark inside one", () => {
    const { unmount } = renderBar({ league: undefined });
    expect(screen.getByRole("link", { name: "PostSzn Fantasy" }).textContent).toBe(
      "PostSznFANTASY",
    );
    expect(screen.queryByRole("button", { name: /League/ })).toBeNull();
    unmount();
    renderBar();
    expect(screen.getByRole("link", { name: /your leagues/ }).textContent).toBe("");
    expect(screen.getByRole("link", { name: /your leagues/ }).getAttribute("href")).toBe("/");
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

  it("signs out from the account menu", () => {
    const onSignOut = vi.fn();
    renderBar({ onSignOut });
    fireEvent.click(screen.getByRole("button", { name: "Account menu" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Sign out" }));
    expect(onSignOut).toHaveBeenCalled();
  });
});
