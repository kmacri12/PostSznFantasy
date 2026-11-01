import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LeagueByUser } from "../../api/types";
import NavBar from "./NavBar";

vi.mock("../dev/DevQuickSync", () => ({ DevQuickSync: () => null }));

const league = (id: number, season: number, finished: boolean): LeagueByUser => ({
  id,
  leagueId: id,
  name: `League ${id}`,
  season,
  isCommissioner: false,
  userTeamId: id,
  hasNewActivity: false,
  finished,
});

beforeEach(() => {
  // Phone width, so the league switcher lives in the drawer.
  window.matchMedia = ((query: string) => ({
    matches: true,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
});

describe("NavBar league switcher", () => {
  it("groups leagues under season headings and tags archives", () => {
    render(
      <MemoryRouter>
        <NavBar
          user={{ id: "u", email: "a@b.c", user_metadata: {} } as never}
          leagues={[league(1, 2025, true), league(2, 2026, false)]}
          selectedLeagueId="2"
          onSelectLeague={() => {}}
          onSignIn={() => {}}
          onSignOut={() => {}}
        />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    const headings = screen.getAllByRole("heading", { level: 3 }).map((node) => node.textContent);
    expect(headings).toEqual(["2026 season", "2025 season"]);
    expect(screen.getAllByText("Archived")).toHaveLength(1);
  });
});
