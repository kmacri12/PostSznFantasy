import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DraftPick, PlayerSummary } from "../../api/types";
import PlayersView, { type DraftActions } from "./PlayersView";

const player = (id: number, name: string, position: string, teamAbv: string): PlayerSummary => ({
  id,
  name,
  position,
  teamAbv,
});

vi.mock("../../api/queries", () => ({
  useDraftPool: () => ({
    data: [
      player(1, "Josh Allen", "QB", "BUF"),
      player(2, "Puka Nacua", "WR", "LAR"),
      player(3, "James Cook", "RB", "BUF"),
    ],
    isLoading: false,
    isError: false,
  }),
  usePlayerSeasonStats: () => ({
    data: [
      { playerId: 1, fantasyPoints: 318.4, passingYards: 4306 },
      { playerId: 2, fantasyPoints: 291 },
    ],
    isLoading: false,
    isError: false,
  }),
  useLeagueSettings: () => ({ data: { id: 1, seasonId: 5, rosterNumFlexWrRbTe: 1 } }),
}));

const teams = [
  { id: 10, name: "Kyle's Kings" },
  { id: 20, name: "Sam's Squad" },
];
const picks = [
  { playerId: 2, teamId: 20, numberRound: 1, numberPickInRound: 3 },
] as unknown as DraftPick[];

const actions = (overrides: Partial<DraftActions> = {}): DraftActions => ({
  live: true,
  canPick: true,
  isConnected: true,
  pendingPlayerId: null,
  capped: {},
  queue: [],
  takenIds: [],
  onPick: vi.fn(),
  onToggleQueue: vi.fn(),
  ...overrides,
});

const renderView = (draft?: DraftActions) =>
  render(
    <PlayersView
      seasonId={5}
      year={2025}
      picks={picks}
      teams={teams}
      myTeamId={10}
      draft={draft}
    />,
  );

const names = () =>
  within(screen.getByRole("list", { name: "Players" }))
    .getAllByRole("listitem")
    .map((item) => item.querySelector("p")?.textContent);

describe("PlayersView outside a draft", () => {
  it("lists every player with points, stat line and the owner chip, and no draft concept", () => {
    renderView();
    expect(names()).toEqual(["Josh Allen", "Puka Nacua", "James Cook"]);
    expect(screen.getByText(/4,306 yds/)).toBeInTheDocument();
    expect(screen.getByText("Sam's Squad")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Available" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Draft / })).toBeNull();
    expect(screen.queryByText(/Drafted by/)).toBeNull();
  });

  it("offers FLEX only because the league has a flex slot, and filters by position and search", () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: "FLEX" }));
    expect(names()).toEqual(["Puka Nacua", "James Cook"]);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search players" }), {
      target: { value: "cook" },
    });
    expect(names()).toEqual(["James Cook"]);
  });
});

describe("PlayersView in the draft room", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("defaults to Available and shows who drafted a player under All", () => {
    renderView(actions());
    expect(names()).toEqual(["Josh Allen", "James Cook"]);
    fireEvent.click(screen.getByRole("button", { name: "All", pressed: false }));
    expect(screen.getByText(/Drafted by Sam's Squad · R1 #3/)).toBeInTheDocument();
  });

  it("needs a second tap to draft", () => {
    const draft = actions();
    renderView(draft);
    fireEvent.click(screen.getByRole("button", { name: "Draft Josh Allen" }));
    expect(draft.onPick).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm Josh Allen" }));
    expect(draft.onPick).toHaveBeenCalledWith(1);
  });

  it("forgets the first tap after a few seconds", () => {
    renderView(actions());
    fireEvent.click(screen.getByRole("button", { name: "Draft Josh Allen" }));
    act(() => {
      vi.advanceTimersByTime(3500);
    });
    expect(screen.getByRole("button", { name: "Draft Josh Allen" })).toBeInTheDocument();
  });

  it("disables Draft off my turn and explains a full position", () => {
    renderView(actions({ canPick: false, capped: { QB: "You already have 2 QBs" } }));
    expect(screen.getByText("You already have 2 QBs")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Draft James Cook" })).toBeDisabled();
  });

  it("queues and unqueues with the star", () => {
    const draft = actions({ queue: [3] });
    renderView(draft);
    fireEvent.click(screen.getByRole("button", { name: "Add Josh Allen to queue" }));
    expect(draft.onToggleQueue).toHaveBeenCalledWith(1);
    expect(
      screen.getByRole("button", { name: "Remove James Cook from queue" }),
    ).toBeInTheDocument();
  });

  it("hides players the server said were already taken", () => {
    renderView(actions({ takenIds: [1] }));
    expect(names()).toEqual(["James Cook"]);
  });
});
