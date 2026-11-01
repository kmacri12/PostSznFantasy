import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LeagueByUser } from "../../api/types";
import NavBar from "./NavBar";

vi.mock("../dev/DevQuickSync", () => ({ DevQuickSync: () => null }));

const league = (id: number, season: number, finished: boolean): LeagueByUser => ({
  id,
  name: `League ${id}`,
  seasonId: id * 10,
  season,
  isCommissioner: false,
  userTeamId: id,
  hasNewActivity: false,
  finished,
  draftStatus: "completed",
  seasons: [],
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
  it("lists each league once and tags those whose season is over", () => {
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
    expect(screen.getByText("League 1")).toBeTruthy();
    expect(screen.getByText("League 2")).toBeTruthy();
    expect(screen.getAllByText("Season over")).toHaveLength(1);
  });
});
