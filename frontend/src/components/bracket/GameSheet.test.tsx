import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api/client";
import type { BracketGame, BracketTeam, GamePlayers } from "../../api/types";
import { SeasonContext } from "../../contexts/SeasonContext";
import { testSeason } from "../../test/season";
import { shortPlayerName } from "./bracketView";
import GameSheet from "./GameSheet";

vi.mock("../../api/client", () => ({ api: { get: vi.fn() } }));

const team = (id: number, abbreviation: string): BracketTeam => ({
  id,
  abbreviation,
  city: abbreviation,
  name: `${abbreviation} Team`,
  logoUrl: null,
  topPlayers: [],
});

const game: BracketGame = {
  id: "20260111_BUF@KC",
  kickoff: null,
  state: "live",
  clock: "Q3 4:12",
  home: team(1, "KC"),
  away: team(2, "BUF"),
  homePoints: 17,
  awayPoints: 10,
  winnerTeamId: null,
  myPlayers: [],
};

const players: GamePlayers = {
  id: game.id as string,
  round: 1,
  state: "live",
  clock: "Q3 4:12",
  away: {
    team: team(2, "BUF"),
    points: 10,
    players: [
      { id: 1, name: "Josh Allen", position: "QB", points: 18.4, fantasyTeam: "Kmac", mine: true },
      {
        id: 2,
        name: "Buffalo Bills",
        position: "DST",
        points: null,
        fantasyTeam: null,
        mine: false,
      },
    ],
  },
  home: {
    team: team(1, "KC"),
    points: 17,
    players: [
      {
        id: 3,
        name: "Kenneth Walker III",
        position: "RB",
        points: 9.2,
        fantasyTeam: "Hamel's Homies",
        mine: false,
      },
    ],
  },
};

const show = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <SeasonContext.Provider value={testSeason({}, true)}>
          <GameSheet game={game} onClose={vi.fn()} />
        </SeasonContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>,
  );

beforeEach(() => {
  vi.mocked(api.get).mockReset();
  window.matchMedia = ((query: string) => ({
    matches: true,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
});

describe("GameSheet", () => {
  it("shows each team's players with game points and their fantasy team", async () => {
    vi.mocked(api.get).mockImplementation(async (url: string) =>
      url.includes("/games/") ? { data: players } : { data: {} },
    );
    show();
    const away = await screen.findByRole("list", { name: "BUF players" });
    const allen = within(away).getAllByRole("listitem")[0] as HTMLElement;
    expect(allen).toHaveTextContent("QBJ. Allen18.4Kmac");
    expect(within(away).getAllByRole("listitem")[1]).toHaveTextContent("DSTDefense-Not drafted");
    expect(screen.getByRole("list", { name: "KC players" })).toHaveTextContent(
      "RBK. Walker III9.2Hamel's Homies",
    );
    expect(vi.mocked(api.get).mock.calls.map((call) => call[0])).toContain(
      "/api/seasons/5/games/20260111_BUF%40KC",
    );
  });

  it("explains a game whose teams are not set", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <SeasonContext.Provider value={testSeason({}, true)}>
          <GameSheet game={{ ...game, id: null, home: null }} onClose={vi.fn()} />
        </SeasonContext.Provider>
      </QueryClientProvider>,
    );
    expect(screen.getByText("The teams are not decided yet.")).toBeInTheDocument();
  });
});

describe("shortPlayerName", () => {
  it("keeps the last name and any suffix, and calls a defense Defense", () => {
    expect(shortPlayerName({ name: "Josh Allen", position: "QB" })).toBe("J. Allen");
    expect(shortPlayerName({ name: "James Cook III", position: "RB" })).toBe("J. Cook III");
    expect(shortPlayerName({ name: "Buffalo Bills", position: "DST" })).toBe("Defense");
    expect(shortPlayerName({ name: "Nakobe", position: "WR" })).toBe("Nakobe");
  });
});
