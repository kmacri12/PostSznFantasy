import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SeasonContext } from "../contexts/SeasonContext";
import { testSeason } from "../test/season";
import DraftPage from "./DraftPage";

const mocks = vi.hoisted(() => ({
  archived: false,
  status: "in_progress",
  socketSeason: undefined as number | undefined,
  seconds: 47 as number | null,
  cues: { onDeck: vi.fn(), onTheClock: vi.fn(), tick: vi.fn() },
  connected: true,
  infoStatus: null as string | null,
}));

const state = () => ({
  seasonId: 5,
  status: mocks.status,
  startTime: null,
  presence: [],
  queue: [],
  picks:
    mocks.status === "completed"
      ? [{ numberPickOverall: 1, teamId: 1, playerName: "A B", position: "QB" }]
      : [],
  reservedPicks: [],
  autopilotTeamIds: [],
  order: [{ slot: 1, teamId: 1, teamName: "Alpha", ownerName: null }],
  rounds: 2,
  draftType: "snake",
  positionCaps: {},
  myTeamId: 1,
  currentPickOverall: 1,
  onTheClockTeamId: 1,
  onDeckTeamId: null,
  totalPicks: 2,
  orderLocked: false,
});

vi.mock("../api/queries", () => ({
  useDraft: () => ({
    data:
      mocks.status === "completed"
        ? state()
        : mocks.infoStatus
          ? { ...state(), status: mocks.infoStatus }
          : undefined,
  }),
  useDraftPool: () => ({ data: [] }),
  useLeagueTeams: () => ({ data: [{ id: 1, name: "Alpha" }] }),
  useSaveQueue: () => ({ mutate: vi.fn() }),
  useSetAutopilot: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
  useRecheckLeague: () => vi.fn(),
}));
vi.mock("../hooks/useDraftRoom", () => ({
  useDraftRoom: (seasonId: number | undefined) => {
    mocks.socketSeason = seasonId;
    return {
      state: seasonId === undefined ? null : state(),
      isConnected: mocks.connected,
      takenPlayerIds: [],
      pendingPlayerId: null,
      secondsLeft: mocks.seconds,
      secondsToStart: null,
      toast: null,
      dismissToast: vi.fn(),
      setQueueLocal: vi.fn(),
      makePick: vi.fn(),
    };
  },
}));
vi.mock("../components/players/PlayersView", () => ({
  default: ({ draft }: { draft?: unknown }) => (
    <div>{draft ? "draft players" : "league players"}</div>
  ),
}));
vi.mock("../components/draft/DraftBoard", () => ({ default: () => <div>board</div> }));
vi.mock("../components/draft/RosterView", () => ({ default: () => <div>roster</div> }));
vi.mock("../components/draft/QueuePanel", () => ({ default: () => <div>queue</div> }));
vi.mock("../components/draft/DraftOrderEditor", () => ({ default: () => <div>order editor</div> }));
vi.mock("../components/draft/CommissionerStrip", () => ({
  default: ({ onEditOrder }: { onEditOrder: () => void }) => (
    <button type="button" onClick={onEditOrder}>
      Edit draft order
    </button>
  ),
}));
vi.mock("../utils/draftCue", () => ({
  playOnDeckCue: mocks.cues.onDeck,
  playOnTheClockCue: mocks.cues.onTheClock,
  playCountdownTick: mocks.cues.tick,
  unlockDraftAudio: vi.fn(),
  vibrateOnTurn: vi.fn(),
}));

const draftPage = () => (
  <MemoryRouter>
    <SeasonContext.Provider
      value={testSeason(
        mocks.archived
          ? { finished: true, canEdit: false, canCommission: false }
          : { canCommission: true, myTeamId: 1 },
      )}
    >
      <DraftPage />
    </SeasonContext.Provider>
  </MemoryRouter>
);

const renderDraft = () => render(draftPage());

beforeEach(() => {
  vi.clearAllMocks();
  mocks.archived = false;
  mocks.status = "in_progress";
  mocks.seconds = 47;
  mocks.connected = true;
  mocks.infoStatus = null;
});

describe("DraftPage", () => {
  it("shows the clock, the commissioner strip and the Players view first", () => {
    renderDraft();
    expect(screen.getByText("You're on the clock")).toBeInTheDocument();
    expect(screen.getByText("Round 1, pick 1")).toBeInTheDocument();
    expect(screen.getByText("draft players")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit draft order" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Players", selected: true })).toBeInTheDocument();
  });

  it("switches between Board, Roster and Queue", () => {
    renderDraft();
    fireEvent.click(screen.getByRole("tab", { name: "Draft board" }));
    expect(screen.getByText("board")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Roster" }));
    expect(screen.getByText("roster")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Queue" }));
    expect(screen.getByText("queue")).toBeInTheDocument();
  });

  it("swaps the view for the order editor while the commissioner edits the order", () => {
    mocks.status = "lobby";
    renderDraft();
    fireEvent.click(screen.getByRole("button", { name: "Edit draft order" }));
    expect(screen.getByText("order editor")).toBeInTheDocument();
    expect(screen.queryByText("draft players")).toBeNull();
  });

  it("opens on the board with the player list a tap away once the draft is complete, with no socket", () => {
    mocks.status = "completed";
    renderDraft();
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Draft board",
      "Players",
    ]);
    expect(screen.getByText("board")).toBeInTheDocument();
    expect(screen.queryByText("league players")).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Players" }));
    expect(screen.getByText("league players")).toBeInTheDocument();
    expect(mocks.socketSeason).toBeUndefined();
  });

  it("announces a finished draft without extra buttons", () => {
    mocks.status = "completed";
    renderDraft();
    expect(screen.getByRole("heading", { name: "Draft complete" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Go to my team" })).toBeNull();
    expect(screen.queryByRole("button", { name: "See the draft board" })).toBeNull();
  });

  it("puts the pick count, Share and the settings cog on one row", () => {
    mocks.status = "completed";
    renderDraft();
    const row = screen.getByRole("region", { name: "Draft complete" });
    expect(within(row).getByText(/picks/)).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "Share draft board" })).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "Draft settings" })).toBeInTheDocument();
  });

  it("shows Draft complete, not a stale clock, when the socket is down and the server says it is over", () => {
    mocks.connected = false;
    mocks.infoStatus = "completed";
    renderDraft();
    expect(screen.getByRole("heading", { name: "Draft complete" })).toBeInTheDocument();
    expect(screen.queryByText("Reconnecting…")).toBeNull();
    expect(screen.queryByRole("timer")).toBeNull();
  });

  it("drops commissioner controls and the Players and Queue views for an archived season", () => {
    mocks.archived = true;
    renderDraft();
    expect(screen.queryByRole("button", { name: "Edit draft order" })).toBeNull();
    expect(screen.queryByRole("tab", { name: "Players" })).toBeNull();
    expect(screen.queryByRole("tab", { name: "Queue" })).toBeNull();
    expect(screen.getByRole("tab", { name: "Draft board" })).toBeInTheDocument();
    expect(screen.getByText(/archived/i)).toBeInTheDocument();
  });
});
