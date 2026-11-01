import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TeamDetails } from "../api/types";
import { SeasonContext } from "../contexts/SeasonContext";
import { testSeason } from "../test/season";
import TeamPage from "./TeamPage";

const mocks = vi.hoisted(() => ({ archived: false }));

const team = {
  id: 7,
  name: "Gridiron",
  seasonId: 3,
  ownerName: "kyle",
  canEdit: true,
  canSetLineup: true,
  canOverride: true,
  roster: [],
  lineups: [
    {
      round: 1,
      slots: [],
      unassigned: [],
      eliminated: [],
      emptyStarterSlots: 0,
      firstKickoff: null,
    },
  ],
} as unknown as TeamDetails;

vi.mock("../api/queries", () => ({
  needsOverrideConfirmation: () => false,
  useTeam: () => ({ isLoading: false, isError: false, data: team }),
  useMoveInLineup: () => ({ mutate: vi.fn(), error: null, isPending: false }),
  useRenameTeam: () => ({ mutateAsync: vi.fn(), error: null, isPending: false }),
}));
vi.mock("../components/activity/ActivityFeed", () => ({ default: () => null }));
vi.mock("../components/common/DataFreshness", () => ({ default: () => null }));
vi.mock("../components/team/LineupList", () => ({
  default: ({ canEdit, canOverride }: { canEdit: boolean; canOverride: boolean }) => (
    <div>{`lineup edit=${canEdit} override=${canOverride}`}</div>
  ),
}));
vi.mock("../components/team/PreDraftRoster", () => ({ default: () => null }));

const renderTeam = () =>
  render(
    <MemoryRouter initialEntries={["/leagues/3/seasons/2025/teams/7"]}>
      <SeasonContext.Provider
        value={testSeason(mocks.archived ? { finished: true, canEdit: false } : {})}
      >
        <Routes>
          <Route path="/leagues/:leagueId/seasons/:year/teams/:teamId" element={<TeamPage />} />
        </Routes>
      </SeasonContext.Provider>
    </MemoryRouter>,
  );

beforeEach(() => {
  mocks.archived = false;
});

describe("TeamPage", () => {
  it("offers renaming while the season is open", () => {
    renderTeam();
    expect(screen.getByRole("button", { name: "Rename team" })).toBeInTheDocument();
    expect(screen.queryByText(/archived/i)).toBeNull();
    expect(screen.getByText("lineup edit=true override=true")).toBeInTheDocument();
  });

  it("hides renaming and explains why once the season is over", () => {
    mocks.archived = true;
    renderTeam();
    expect(screen.queryByRole("button", { name: "Rename team" })).toBeNull();
    expect(screen.getByText(/archived/i)).toBeInTheDocument();
    expect(screen.getByText("lineup edit=false override=false")).toBeInTheDocument();
  });
});
