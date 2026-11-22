import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LeagueByUser, Standings } from "../../api/types";
import LeagueCard from "./LeagueCard";

const mocks = vi.hoisted(() => ({
  standings: { data: undefined as unknown, isLoading: false },
}));

vi.mock("../../api/queries", () => ({
  useStandings: () => mocks.standings,
  useDraft: () => ({ data: undefined }),
}));

const league = {
  id: 3,
  seasonId: 9,
  name: "The League",
  finished: false,
  draftStatus: "completed",
  userTeamId: 1,
  hasNewActivity: false,
  avatarUrl: null,
} as unknown as LeagueByUser;

const standings = {
  phase: "live",
  round: 2,
  gamesInProgress: 1,
  gamesFinal: 0,
  playersLeft: 10,
  teams: [
    {
      teamId: 1,
      rank: 1,
      teamName: "Hamel's Homies",
      owner: "me",
      total: 84.2,
      wildCard: 28.4,
      divisional: 43.2,
    },
    { teamId: 2, rank: 2, teamName: "Other", owner: "you", total: 70 },
  ],
} as unknown as Standings;

const show = (l: LeagueByUser = league) =>
  render(
    <MemoryRouter>
      <LeagueCard league={l} />
    </MemoryRouter>,
  );

beforeEach(() => {
  mocks.standings = { data: standings, isLoading: false };
});

describe("LeagueCard", () => {
  it("names my team beside the rank and shows this round's points", () => {
    show();
    expect(screen.getByText("Hamel's Homies")).toBeInTheDocument();
    expect(screen.getByText("1st")).toBeInTheDocument();
    expect(screen.getByText("points · 43.2 this round")).toBeInTheDocument();
  });

  it("leaves the playoff round to the page, so it is not repeated on every card", () => {
    show();
    expect(screen.queryByText(/Wild Card|Divisional|Conference Championship|Super Bowl/)).toBeNull();
  });

  it("adds nothing about the round once the season is finished", () => {
    show({ ...league, finished: true });
    expect(screen.getByText("points")).toBeInTheDocument();
  });
});
