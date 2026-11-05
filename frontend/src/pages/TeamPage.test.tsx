import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TeamDetails } from "../api/types";
import { SeasonContext } from "../contexts/SeasonContext";
import { lineupPlayer, roundLineup, slot } from "../test/lineup";
import { testSeason } from "../test/season";
import TeamPage from "./TeamPage";

const mocks = vi.hoisted(() => ({ archived: false }));

const allen = lineupPlayer({
  id: 1,
  name: "Josh Allen",
  position: "QB",
  gameState: "live",
  gameClock: "8:42",
  statLine: "14/21, 168 yds, 2 TD, 0 INT",
  points: 17.4,
});
const nacua = lineupPlayer({ id: 2, name: "Puka Nacua", position: "WR", points: 13.4 });
const flowers = lineupPlayer({
  id: 3,
  name: "Zay Flowers",
  position: "WR",
  status: "eliminated",
  eliminatedRound: 2,
});

const team = {
  id: 7,
  name: "Gridiron",
  seasonId: 3,
  ownerName: "kyle",
  canEdit: true,
  canSetLineup: true,
  canOverride: true,
  roster: [allen, nacua, flowers],
  lineups: [
    roundLineup(1),
    roundLineup(2),
    roundLineup(3, {
      slots: [slot(0, "QB", allen), slot(1, "BENCH", nacua)],
      eliminated: [flowers],
      firstKickoff: "2020-01-01T00:00:00Z",
    }),
    roundLineup(4),
  ],
} as unknown as TeamDetails;

vi.mock("../api/queries", () => ({
  needsOverrideConfirmation: () => false,
  useTeam: () => ({ isLoading: false, isError: false, data: team }),
  useStandings: () => ({ data: { teams: [{ teamId: 7, rank: 2, total: 71.6 }] } }),
  usePlayerSeasonLine: () => ({ isPending: false, data: null }),
  useMoveInLineup: () => ({ mutate: vi.fn(), reset: vi.fn(), error: null, isPending: false }),
  useRenameTeam: () => ({ mutateAsync: vi.fn(), error: null, isPending: false }),
}));
vi.mock("../components/common/DataFreshness", () => ({ default: () => null }));
vi.mock("../components/team/PreDraftRoster", () => ({ default: () => null }));

const renderTeam = (myTeamId: number | null = 7) =>
  render(
    <MemoryRouter initialEntries={["/leagues/3/seasons/2025/teams/7"]}>
      <SeasonContext.Provider
        value={testSeason({
          myTeamId,
          ...(mocks.archived ? { finished: true, canEdit: false } : {}),
        })}
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
  it("heads the page with the team, who owns it, the rank and the total", () => {
    renderTeam();
    expect(screen.getByRole("heading", { name: "Gridiron" })).toBeInTheDocument();
    expect(screen.getByText("You · rank 2")).toBeInTheDocument();
    expect(screen.getByText("71.6")).toBeInTheDocument();
    renderTeam(null);
    expect(screen.getByText("kyle · rank 2")).toBeInTheDocument();
  });

  it("opens on the current round with Starters, Bench and Eliminated groups", () => {
    renderTeam();
    expect(
      screen.getByRole("tab", { name: "Conference Championship", selected: true }),
    ).toBeInTheDocument();
    const starters = screen.getByRole("region", { name: "Starters" });
    expect(within(starters).getByText("Josh Allen")).toBeInTheDocument();
    expect(
      within(starters).getByText("Live 8:42 · 14/21, 168 yds, 2 TD, 0 INT"),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "Bench" })).getByText("Puka Nacua"),
    ).toBeInTheDocument();
    const eliminated = screen.getByRole("region", { name: "Eliminated" });
    expect(within(eliminated).getByText("Eliminated in Divisional")).toBeInTheDocument();
  });

  it("switches round from the strip", () => {
    renderTeam();
    fireEvent.click(screen.getByRole("tab", { name: "Super Bowl" }));
    expect(screen.getByRole("tab", { name: "Super Bowl", selected: true })).toBeInTheDocument();
    expect(screen.queryByText("Josh Allen")).toBeNull();
  });

  it("opens the player sheet from a name", () => {
    renderTeam();
    fireEvent.click(screen.getByRole("button", { name: "WR Puka Nacua" }));
    expect(screen.getByRole("heading", { name: "Puka Nacua" })).toBeInTheDocument();
  });

  it("offers renaming while the season is open", () => {
    renderTeam();
    expect(screen.getByRole("button", { name: "Rename team" })).toBeInTheDocument();
    expect(screen.queryByText(/archived/i)).toBeNull();
  });

  it("hides renaming and explains why once the season is over", () => {
    mocks.archived = true;
    renderTeam();
    expect(screen.queryByRole("button", { name: "Rename team" })).toBeNull();
    expect(screen.getByText(/archived/i)).toBeInTheDocument();
  });
});
