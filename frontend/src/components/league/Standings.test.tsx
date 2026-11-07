import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Standings as Data, SeasonOverview, StandingsRow } from "../../api/types";
import { SeasonContext } from "../../contexts/SeasonContext";
import { testSeason } from "../../test/season";
import Standings from "./Standings";

const mocks = vi.hoisted(() => ({
  query: { data: undefined as unknown, isLoading: false, isError: false, error: null },
}));

vi.mock("../../api/queries", () => ({
  useStandings: () => ({ ...mocks.query, refetch: vi.fn() }),
}));

const row = (
  teamId: number,
  rank: number | null,
  extra: Partial<StandingsRow> = {},
): StandingsRow => ({
  teamId,
  rank,
  teamName: `Team ${teamId}`,
  owner: `owner${teamId}`,
  isCommissioner: false,
  playersLeft: 6,
  wildCard: 28.4,
  divisional: 43.2,
  confChamp: 12.6,
  superBowl: 0,
  total: 84.2,
  tieReason: null,
  progress: { finished: 0, live: 2, toPlay: 1, notPlaying: 6 },
  ...extra,
});

const live: Data = {
  phase: "live",
  round: 3,
  gamesInProgress: 2,
  gamesFinal: 1,
  playersLeft: 12,
  teams: [row(2, 2, { total: 71.6, confChamp: 9.4, isCommissioner: true }), row(1, 1)],
};

const show = (data: Data, season: Partial<SeasonOverview> = {}) => {
  mocks.query = { data, isLoading: false, isError: false, error: null };
  const ctx = testSeason(season, true);
  return render(
    <MemoryRouter>
      <SeasonContext.Provider value={ctx}>
        <Standings season={ctx.season} />
      </SeasonContext.Provider>
    </MemoryRouter>,
  );
};

const phoneList = () => screen.getAllByRole("list", { name: "Standings" })[0] as HTMLElement;

beforeEach(() => {
  mocks.query = { data: undefined, isLoading: false, isError: false, error: null };
});

describe("Standings", () => {
  it("ranks teams with total prominent and the current round beside it", () => {
    show(live);
    const items = within(phoneList()).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0] as HTMLElement).getByText("Team 1")).toBeInTheDocument();
    expect(within(items[0] as HTMLElement).getByText("84.2")).toBeInTheDocument();
    expect(within(items[0] as HTMLElement).getByText("12.6")).toBeInTheDocument();
    expect(
      within(items[1] as HTMLElement).getByText("owner2 · commissioner · 6 left · 2 live"),
    ).toBeInTheDocument();
  });

  it("expands one row at a time to the four rounds, with a dash for rounds to come", () => {
    show(live);
    const [first, second] = within(phoneList()).getAllByRole("button") as HTMLElement[];
    fireEvent.click(first as HTMLElement);
    const panel = document.getElementById("standings-1") as HTMLElement;
    expect(within(panel).getByText("28.4")).toBeInTheDocument();
    expect(within(panel).getByText("-")).toBeInTheDocument();
    expect(within(panel).getByRole("link", { name: "Open team page" })).toHaveAttribute(
      "href",
      "/leagues/3/teams/1",
    );
    fireEvent.click(second as HTMLElement);
    expect(first).toHaveAttribute("aria-expanded", "false");
    expect(second).toHaveAttribute("aria-expanded", "true");
  });

  it("marks shared ranks as ties", () => {
    show({ ...live, teams: [row(1, 1), row(2, 1)] });
    // The picture fallback also reads "T1" (the initials of "Team 1"); only count the rank labels.
    const ranks = within(phoneList())
      .getAllByText("T1")
      .filter((element) => !element.closest(".MuiAvatar-root"));
    expect(ranks).toHaveLength(2);
  });

  it("lists every slot before the draft, open ones included, without points", () => {
    show(
      { ...live, phase: "pre_draft", teams: [row(1, null), row(2, null, { owner: null })] },
      { draftStatus: "unscheduled" },
    );
    expect(screen.getByText("Open slot")).toBeInTheDocument();
    expect(screen.getByText("Waiting for a player")).toBeInTheDocument();
    expect(screen.getByText("1 of 2 filled")).toBeInTheDocument();
    expect(screen.queryByText("0.0")).toBeNull();
  });

  it("shows zero points and a shared first place once the draft is scheduled", () => {
    show(
      { ...live, phase: "pre_draft", teams: [row(1, null), row(2, null)] },
      { draftStatus: "scheduled" },
    );
    expect(screen.getAllByText("0.0")).toHaveLength(2);
  });

  it("titles a finished season's table Final standings", () => {
    show(live, { finished: true });
    expect(screen.getAllByText("Final standings").length).toBeGreaterThan(0);
  });
});
