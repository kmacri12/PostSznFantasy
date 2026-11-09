import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SeasonOverview, Standings } from "../../api/types";
import { SeasonContext } from "../../contexts/SeasonContext";
import { testSeason } from "../../test/season";
import PhaseBlock from "./PhaseBlock";

const mocks = vi.hoisted(() => ({
  draft: { data: undefined as unknown, isLoading: false },
  standings: { data: undefined as unknown },
}));

vi.mock("../../api/queries", () => ({
  useDraft: () => mocks.draft,
  useStandings: () => mocks.standings,
  useInvite: () => ({ data: { code: "ABC123" }, isLoading: false }),
  useRegenerateInvite: () => ({ mutate: vi.fn(), isPending: false }),
}));

const standings = (extra: Partial<Standings> = {}, mine = { live: 3, toPlay: 1 }): Standings => ({
  phase: "live",
  round: 3,
  gamesInProgress: 2,
  gamesFinal: 1,
  playersLeft: 9,
  teams: [
    {
      teamId: 1,
      rank: 1,
      teamName: "Mine",
      owner: "me",
      isCommissioner: false,
      playersLeft: 5,
      wildCard: 0,
      divisional: 0,
      confChamp: 0,
      superBowl: 0,
      total: 0,
      tieReason: null,
      progress: { finished: 0, notPlaying: 1, ...mine },
    },
  ],
  ...extra,
});

const show = (season: Partial<SeasonOverview>) =>
  render(
    <MemoryRouter>
      <SeasonContext.Provider value={testSeason(season, true)}>
        <PhaseBlock season={testSeason(season, true).season} />
      </SeasonContext.Provider>
    </MemoryRouter>,
  );

beforeEach(() => {
  mocks.draft = { data: undefined, isLoading: false };
  mocks.standings = { data: undefined };
  vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
  vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));
});

afterEach(() => vi.useRealTimers());

describe("PhaseBlock", () => {
  it("asks a commissioner to invite friends while the draft is unscheduled", () => {
    show({ draftStatus: "unscheduled", numberTeams: 6, openSpots: 2, canCommission: true });
    expect(screen.getByText("Invite your friends")).toBeInTheDocument();
    expect(screen.getByText("4 of 6 teams filled. Draft date not set yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy invite link" })).toBeInTheDocument();
  });

  it("tells a member the commissioner has not scheduled the draft", () => {
    show({ draftStatus: "unscheduled" });
    expect(screen.getByText("Draft not yet scheduled by your commissioner")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("counts down to a scheduled draft and links to the draft room", () => {
    mocks.draft = {
      data: {
        startTime: "2026-01-03T16:12:00Z",
        order: [
          { slot: 1, teamId: 8, teamName: "A", ownerName: "a" },
          { slot: 2, teamId: 9, teamName: "B", ownerName: "b" },
          { slot: 3, teamId: 1, teamName: "Me", ownerName: "me" },
        ],
      },
      isLoading: false,
    };
    show({ draftStatus: "scheduled", draftStartTime: "2026-01-03T16:12:00Z" });
    expect(screen.getByText("Draft starts in")).toBeInTheDocument();
    expect(screen.getByText("2d 4h 12m")).toBeInTheDocument();
    expect(screen.getByText(/you pick 3rd/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Enter draft" })).toHaveAttribute(
      "href",
      "/leagues/3/draft",
    );
  });

  it("says what a passed draft time is waiting for, and gives the commissioner Start", () => {
    show({ draftStatus: "scheduled", draftStartTime: "2026-01-01T11:00:00Z", canCommission: true });
    expect(screen.getByText("Draft time has passed")).toBeInTheDocument();
    expect(screen.queryByText("Starting now")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start the draft" })).toBeInTheDocument();
  });

  it("tells a member the draft waits for the commissioner", () => {
    show({
      draftStatus: "scheduled",
      draftStartTime: "2026-01-01T11:00:00Z",
      canCommission: false,
    });
    expect(screen.getByText("Waiting for your commissioner to start it.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Enter draft" })).toBeInTheDocument();
  });

  it("offers to enter a draft that is under way", () => {
    show({ draftStatus: "in_progress" });
    expect(screen.getByText("The draft is under way")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Enter draft" })).toBeInTheDocument();
  });

  it("asks for a lineup before the first kickoff", () => {
    mocks.draft = { data: { draftCutoff: "2026-01-10T21:30:00Z" }, isLoading: false };
    mocks.standings = { data: standings({ round: 1, gamesInProgress: 0, gamesFinal: 0 }) };
    show({ draftStatus: "completed" });
    expect(screen.getByText("Set your lineup")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open my team" })).toHaveAttribute(
      "href",
      "/leagues/3/teams/1",
    );
  });

  it("summarises the round, the games and my lineup once the playoffs run", () => {
    mocks.draft = { data: { draftCutoff: "2026-01-02T00:00:00Z" }, isLoading: false };
    mocks.standings = { data: standings() };
    show({ draftStatus: "completed" });
    expect(screen.getByText("Conference Championship")).toBeInTheDocument();
    expect(screen.getByText("2 games live, 1 final")).toBeInTheDocument();
    expect(screen.getByText("Your lineup: 3 live, 1 to play")).toBeInTheDocument();
  });

  it("leaves the top to the champion card when the season is over", () => {
    const { container } = show({ draftStatus: "completed", finished: true });
    expect(container).toBeEmptyDOMElement();
  });
});
