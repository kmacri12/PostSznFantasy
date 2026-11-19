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

const openFilters = () => {
  const filters = screen.getByRole("button", { name: "Filters" });
  if (filters.getAttribute("aria-expanded") !== "true") fireEvent.click(filters);
};

const chooseStatus = (label: string) => {
  openFilters();
  fireEvent.click(screen.getByRole("button", { name: /Status/ }));
  fireEvent.click(screen.getByRole("menuitem", { name: label }));
};

describe("PlayersView outside a draft", () => {
  it("lists every player with points, stat line and the owner chip, all statuses by default", () => {
    renderView();
    expect(names()).toEqual(["Josh Allen", "Puka Nacua", "James Cook"]);
    expect(screen.getByText(/4,306 yds/)).toBeInTheDocument();
    expect(screen.getByText("Sam's Squad")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "FLEX" })).toBeNull();
    openFilters();
    expect(screen.getByRole("button", { name: "Status: All" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Draft / })).toBeNull();
    expect(screen.queryByText(/Drafted by/)).toBeNull();
  });

  it("offers FLEX only because the league has a flex slot, and filters by position and search", () => {
    renderView();
    openFilters();
    fireEvent.click(screen.getByRole("button", { name: "FLEX" }));
    expect(names()).toEqual(["Puka Nacua", "James Cook"]);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search players" }), {
      target: { value: "cook" },
    });
    expect(names()).toEqual(["James Cook"]);
  });
});

describe("PlayersView filters panel", () => {
  it("stays open while choosing filters until the Filters button is tapped again", () => {
    renderView();
    const filters = screen.getByRole("button", { name: "Filters" });
    expect(filters).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(filters);
    fireEvent.click(screen.getByRole("button", { name: "QB" }));
    expect(filters).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "QB", pressed: true })).toBeInTheDocument();
    fireEvent.click(filters);
    expect(filters).toHaveAttribute("aria-expanded", "false");
    expect(names()).toEqual(["Josh Allen"]);
  });

  it("hides Filters and Sort while the search box has focus", () => {
    renderView();
    const search = screen.getByRole("searchbox", { name: "Search players" });
    fireEvent.focus(search);
    expect(screen.queryByRole("button", { name: "Filters" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Sort:/ })).toBeNull();
    fireEvent.blur(search);
    expect(screen.getByRole("button", { name: "Filters" })).toBeInTheDocument();
  });

  it("closes the keyboard on the Search key, keeping the search and bringing the buttons back", () => {
    renderView();
    const search = screen.getByRole("searchbox", { name: "Search players" });
    search.focus();
    fireEvent.change(search, { target: { value: "cook" } });
    expect(screen.queryByRole("button", { name: "Filters" })).toBeNull();
    fireEvent.keyDown(search, { key: "Enter" });
    expect(search).not.toHaveFocus();
    expect(screen.getByRole("button", { name: "Filters" })).toBeInTheDocument();
    expect(names()).toEqual(["James Cook"]);
  });
});

describe("PlayersView in the draft room", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("defaults to Available and shows who drafted a player under All", () => {
    renderView(actions());
    expect(names()).toEqual(["Josh Allen", "James Cook"]);
    openFilters();
    expect(screen.getByRole("button", { name: "Status: Available" })).toBeInTheDocument();
    chooseStatus("All");
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
    renderView(actions({ canPick: false, capped: { QB: "Position max reached" } }));
    expect(screen.getByText("Position max reached")).toBeInTheDocument();
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

  it("lists drafted players under Drafted even when the room marks them taken", () => {
    renderView(actions({ takenIds: [2] }));
    expect(names()).toEqual(["Josh Allen", "James Cook"]);
    chooseStatus("Drafted");
    expect(names()).toEqual(["Puka Nacua"]);
  });

  it("lists a fantasy team's drafted players, leaving Available for All", () => {
    renderView(actions({ takenIds: [2] }));
    openFilters();
    fireEvent.click(screen.getByRole("button", { name: /^Fantasy/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Sam's Squad" }));
    expect(names()).toEqual(["Puka Nacua"]);
    // Set filters show only their choice, with the label kept for screen readers.
    expect(screen.getByRole("button", { name: "Sam's Squad, Fantasy" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "All, Status" })).toBeInTheDocument();
  });
});
