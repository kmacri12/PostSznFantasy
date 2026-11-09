import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { SeasonContext } from "../contexts/SeasonContext";
import { testSeason } from "../test/season";
import LeaguePage from "./LeaguePage";

const mocks = vi.hoisted(() => ({ info: undefined as unknown }));

vi.mock("../api/queries", () => ({
  useLeagueInfo: () => ({ data: mocks.info }),
  useRecap: () => ({ data: undefined }),
}));
vi.mock("../components/league/PhaseBlock", () => ({ default: () => null }));
vi.mock("../components/league/Standings", () => ({ default: () => null }));
vi.mock("../components/league/LeagueNotes", () => ({ default: () => null }));
vi.mock("../components/common/DataFreshness", () => ({ default: () => null }));

const renderLeague = (seasonOverrides = {}) =>
  render(
    <MemoryRouter>
      <SeasonContext.Provider value={testSeason(seasonOverrides, true)}>
        <LeaguePage />
      </SeasonContext.Provider>
    </MemoryRouter>,
  );

describe("League page settings cog", () => {
  it("opens league settings from the cog, for a commissioner and for a member", () => {
    for (const myRole of ["commissioner", "member"]) {
      mocks.info = { name: "Sunday League", myRole, notes: "", members: [], seasons: [] };
      const { unmount } = renderLeague();
      expect(screen.getByRole("heading", { name: "Sunday League" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "League settings" })).toHaveAttribute(
        "href",
        "/leagues/3/settings",
      );
      unmount();
    }
  });

  it("keeps the cog on a finished season, where league settings are read-only", () => {
    mocks.info = { name: "Sunday League", myRole: "commissioner", notes: "", members: [] };
    renderLeague({ finished: true, canEdit: false });
    expect(screen.getByRole("link", { name: "League settings" })).toBeInTheDocument();
  });

  it("has no cog for a former member, who cannot read the league's information", () => {
    mocks.info = undefined;
    renderLeague({ isFormerMember: true });
    expect(screen.queryByRole("link", { name: "League settings" })).toBeNull();
  });
});
