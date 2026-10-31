import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DraftPage from "./DraftPage";

const mocks = vi.hoisted(() => ({ archived: false }));

const state = {
  leagueId: 3,
  status: "completed",
  presence: [],
  queue: [],
  picks: [],
  positionCaps: {},
  myTeamId: 1,
  onTheClockTeamId: null,
  onDeckTeamId: null,
};

vi.mock("../api/queries", () => ({
  useDraftPool: () => ({ data: [] }),
  useLeague: () => ({ data: { myRole: "commissioner" } }),
  useSaveQueue: () => ({ mutate: vi.fn() }),
  useLeagueArchived: () => mocks.archived,
}));
vi.mock("../hooks/useDraftRoom", () => ({
  useDraftRoom: () => ({
    state,
    isConnected: true,
    takenPlayerIds: [],
    secondsLeft: null,
    secondsToStart: null,
    toast: null,
    dismissToast: vi.fn(),
  }),
}));
vi.mock("../components/draft/AvailablePlayers", () => ({ default: () => null }));
vi.mock("../components/draft/DraftBoard", () => ({ default: () => null }));
vi.mock("../components/draft/DraftSetupPanel", () => ({ default: () => null }));
vi.mock("../components/draft/DraftStatusBar", () => ({ default: () => null }));
vi.mock("../components/draft/DraftToast", () => ({ default: () => null }));
vi.mock("../components/draft/MyRosterPanel", () => ({ default: () => null }));
vi.mock("../components/draft/OnTheClockBanner", () => ({ default: () => null }));
vi.mock("../components/draft/PausedBanner", () => ({ default: () => null }));
vi.mock("../components/draft/PickFeed", () => ({ default: () => null }));
vi.mock("../components/draft/PreDraftNotice", () => ({ default: () => null }));
vi.mock("../components/draft/QueuePanel", () => ({ default: () => null }));
vi.mock("../components/draft/CommissionerControls", () => ({
  default: () => <button type="button">Draft controls</button>,
}));
vi.mock("../utils/draftCue", () => ({ playOnDeckCue: vi.fn(), vibrateOnTurn: vi.fn() }));

const renderDraft = () =>
  render(
    <MemoryRouter initialEntries={["/league/3/draft"]}>
      <Routes>
        <Route path="/league/:leagueId/draft" element={<DraftPage />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  mocks.archived = false;
});

describe("DraftPage", () => {
  it("gives a commissioner setup and controls while the league is live", () => {
    renderDraft();
    expect(screen.getByText("Draft setup")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Draft controls" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Players/ })).toBeInTheDocument();
  });

  it("drops setup, controls and the pick and queue tabs once the league is archived", () => {
    mocks.archived = true;
    renderDraft();
    expect(screen.queryByText("Draft setup")).toBeNull();
    expect(screen.queryByRole("button", { name: "Draft controls" })).toBeNull();
    expect(screen.queryByRole("tab", { name: /Players/ })).toBeNull();
    expect(screen.queryByRole("tab", { name: /Queue/ })).toBeNull();
    expect(screen.getByRole("tab", { name: "Board" })).toBeInTheDocument();
    expect(screen.getByText(/archived/i)).toBeInTheDocument();
  });
});
