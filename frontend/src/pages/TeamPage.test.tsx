import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TeamDetails } from "../api/types";
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
  useLeagueArchived: () => mocks.archived,
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
    <MemoryRouter initialEntries={["/team/7"]}>
      <Routes>
        <Route path="/team/:teamId" element={<TeamPage />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  mocks.archived = false;
});

describe("TeamPage", () => {
  it("offers renaming while the league is live", () => {
    renderTeam();
    expect(screen.getByRole("button", { name: "Rename team" })).toBeInTheDocument();
    expect(screen.queryByText(/archived/i)).toBeNull();
    expect(screen.getByText("lineup edit=true override=true")).toBeInTheDocument();
  });

  it("hides renaming and explains why once the league is archived", () => {
    mocks.archived = true;
    renderTeam();
    expect(screen.queryByRole("button", { name: "Rename team" })).toBeNull();
    expect(screen.getByText(/archived/i)).toBeInTheDocument();
    expect(screen.getByText("lineup edit=false override=false")).toBeInTheDocument();
  });
});
