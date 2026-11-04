import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { Standings, StandingsRow } from "../../api/types";
import { SeasonContext } from "../../contexts/SeasonContext";
import { testSeason } from "../../test/season";
import StandingsTable from "./StandingsTable";

const mocks = vi.hoisted(() => ({ standings: undefined as unknown }));
vi.mock("../../api/queries", () => ({
  useStandings: () => ({ isLoading: false, isError: false, data: mocks.standings }),
}));

const slot = (teamId: number, extra: Partial<StandingsRow> = {}): StandingsRow => ({
  teamId,
  rank: null,
  teamName: `Team ${teamId}`,
  owner: "ann",
  isCommissioner: false,
  playersLeft: 0,
  wildCard: 0,
  divisional: 0,
  confChamp: 0,
  superBowl: 0,
  total: 0,
  tieReason: null,
  progress: { finished: 0, live: 0, toPlay: 0, notPlaying: 0 },
  ...extra,
});

const renderTable = (standings: Standings) => {
  mocks.standings = standings;
  render(
    <MemoryRouter>
      <SeasonContext.Provider value={testSeason()}>
        <StandingsTable />
      </SeasonContext.Provider>
    </MemoryRouter>,
  );
};

describe("StandingsTable before the draft", () => {
  it("states the phase and shows filled and open slots in both layouts", () => {
    renderTable({
      phase: "pre_draft",
      round: 1,
      gamesInProgress: 0,
      gamesFinal: 0,
      playersLeft: 0,
      teams: [
        slot(1, { isCommissioner: true }),
        slot(2, { owner: null }),
        slot(3, { owner: null }),
      ],
    });
    expect(screen.getByText("Waiting for the draft: 1 of 3 teams filled.")).toBeTruthy();
    // Phone cards and the desktop table are both in the DOM; CSS shows one.
    expect(screen.getAllByText("Open spot")).toHaveLength(4);
    expect(screen.getAllByText("Team 1")).toHaveLength(2);
    expect(screen.queryByText("No standings yet")).toBeNull();
  });
});
