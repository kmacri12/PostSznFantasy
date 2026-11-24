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
  gamesToPlay: 0,
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
    expect(items[1]?.textContent).toContain("owner2, commissioner");
    expect(items[1]?.textContent).not.toContain("live");
  });

  it("rings each team's picture with a dot per player while the season is on", () => {
    const dots = { advanced: 4, live: 3, toPlay: 6, eliminated: 2 };
    show({ ...live, teams: [row(1, 1, { rosterStatus: dots }), row(2, 2)] });
    const items = within(phoneList()).getAllByRole("listitem");
    expect(
      within(items[0] as HTMLElement).getByRole("button", {
        name: "13 players left: 4 advanced, 3 live, 6 yet to play, 2 eliminated",
      }),
    ).toBeInTheDocument();
    expect(within(items[0] as HTMLElement).queryByTestId("out-wash")).toBeNull();
    expect((items[0] as HTMLElement).textContent).not.toContain("players left"); // on the tap only
    // No roster status: no ring, no extra button beyond the row's own expand control.
    expect(within(items[1] as HTMLElement).getAllByRole("button")).toHaveLength(1);
  });

  it("opens the breakdown from the picture without expanding the row", () => {
    const dots = { advanced: 4, live: 3, toPlay: 6, eliminated: 2 };
    show({ ...live, teams: [row(1, 1, { rosterStatus: dots })] });
    const item = within(phoneList()).getAllByRole("listitem")[0] as HTMLElement;
    fireEvent.click(within(item).getByRole("button", { name: /^13 players left: / }));
    expect(screen.getByRole("note")).toHaveTextContent("2 eliminated");
    expect(screen.getByRole("note")).toHaveTextContent("6 yet to play");
    // The row stayed closed: its expand button still says so.
    expect(item.querySelector('button[aria-controls="standings-1"]')).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(document.getElementById("standings-1")).toBeNull();
  });

  it("washes the picture red when nobody is left", () => {
    const dots = { advanced: 0, live: 0, toPlay: 0, eliminated: 15 };
    show({ ...live, teams: [row(1, 1, { rosterStatus: dots })] });
    const item = within(phoneList()).getAllByRole("listitem")[0] as HTMLElement;
    expect(within(item).getByTestId("out-wash")).toBeInTheDocument();
  });

  it("leaves the ring out of a finished season's table", () => {
    const dots = { advanced: 4, live: 0, toPlay: 0, eliminated: 11 };
    show({ ...live, teams: [row(1, 1, { rosterStatus: dots })] }, { finished: true });
    expect(screen.queryByRole("img", { name: /players left/ })).toBeNull();
  });

  it("expands rows to the four rounds, several at once, with a dash for rounds to come", () => {
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
    expect(first).toHaveAttribute("aria-expanded", "true");
    expect(second).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(first as HTMLElement);
    expect(first).toHaveAttribute("aria-expanded", "false");
    expect(second).toHaveAttribute("aria-expanded", "true");
  });

  it("shows green and red movement arrows under the rank, and a dash for no move", () => {
    show({
      ...live,
      teams: [
        row(1, 1, { rankChange: 2 }),
        row(2, 2, { rankChange: -1 }),
        row(3, 3, { rankChange: 0 }),
      ],
    });
    const list = within(phoneList());
    expect(list.getByText(", up 2 places")).toBeInTheDocument();
    expect(list.getByText(", down 1 place")).toBeInTheDocument();
    expect(list.getByText(", no change")).toBeInTheDocument();
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
